#!/usr/bin/env python3
"""
Generate CREATE TABLE IF NOT EXISTS SQL for every model in schema.prisma
that does not already exist in:
  - prisma/migrations/0_init/migration.sql
  - scripts/schema-sync.js

Output: writes a single JS file `scripts/_generated-tables.js` whose default
export is an array of SQL strings, suitable for splicing into schema-sync.js.

Type mapping (Prisma → Postgres):
  String         → TEXT
  Int            → INTEGER
  BigInt         → BIGINT
  Float          → DOUBLE PRECISION
  Decimal        → DOUBLE PRECISION   (good enough for our scale)
  Boolean        → BOOLEAN
  DateTime       → TIMESTAMP(3)
  Json           → JSONB
  Bytes          → BYTEA

Modifier handling:
  @id                              → column goes into PRIMARY KEY list
  @default(now())                  → DEFAULT CURRENT_TIMESTAMP
  @default(cuid()) / @default(uuid()) → omitted (DB-side default not needed; app supplies)
  @default(true|false|<num>|"<str>")  → DEFAULT <literal>
  @default(autoincrement())        → GENERATED ALWAYS AS IDENTITY
  @unique                          → CREATE UNIQUE INDEX after CREATE TABLE
  @relation(fields: [fk])          → the fk field is a real column; relation itself is metadata
  [] (array suffix)                → skip (back-reference, not a column)
  Unsupported("...")               → TEXT (fallback)

For composite @@unique([a, b]) we emit a CREATE UNIQUE INDEX.
For @@index([a, b]) we emit CREATE INDEX.
"""
from __future__ import annotations
import re
import sys
import json
from pathlib import Path

SCHEMA = Path(__file__).resolve().parent.parent / "prisma" / "schema.prisma"
INIT_SQL = Path(__file__).resolve().parent.parent / "prisma" / "migrations" / "0_init" / "migration.sql"
SYNC_JS = Path(__file__).resolve().parent / "schema-sync.js"
OUT_JS = Path(__file__).resolve().parent / "_generated-tables.js"

PRISMA_TO_PG = {
    "String": "TEXT",
    "Int": "INTEGER",
    "BigInt": "BIGINT",
    "Float": "DOUBLE PRECISION",
    "Decimal": "DOUBLE PRECISION",
    "Boolean": "BOOLEAN",
    "DateTime": "TIMESTAMP(3)",
    "Json": "JSONB",
    "Bytes": "BYTEA",
}


def parse_schema(text: str):
    """Yield (model_name, fields, block_attributes)."""
    lines = text.splitlines()
    i = 0
    while i < len(lines):
        m = re.match(r"^model\s+(\w+)\s*\{", lines[i])
        if not m:
            i += 1
            continue
        name = m.group(1)
        i += 1
        fields = []
        block_attrs = []
        depth = 1
        while i < len(lines) and depth > 0:
            ln = lines[i].rstrip()
            stripped = ln.strip()
            if stripped == "}":
                depth -= 1
                i += 1
                continue
            if stripped.startswith("//") or not stripped:
                i += 1
                continue
            # Block attribute: @@index, @@unique, @@id, etc.
            if stripped.startswith("@@"):
                block_attrs.append(stripped)
                i += 1
                continue
            # Field-level attribute on its own line (rare): starts with @ but no name
            # Regular field line:  fieldName  Type  @mods...
            parts = stripped.split()
            if len(parts) >= 2 and not parts[0].startswith("@"):
                fname = parts[0]
                ftype = parts[1]
                mods = " ".join(parts[2:])
                fields.append({"name": fname, "type": ftype, "mods": mods, "raw": stripped})
            i += 1
        yield name, fields, block_attrs


def base_type(ftype: str) -> str:
    """Strip optional/array/Unsupported wrapper to get base type."""
    if ftype.endswith("[]"):
        return None  # array — back-reference, not a column
    if ftype.startswith("Unsupported("):
        return "TEXT"
    # Optional "?" suffix
    if ftype.endswith("?"):
        ftype = ftype[:-1]
    return PRISMA_TO_PG.get(ftype, "TEXT")


def field_default(mods: str, base_pg: str):
    """Return (default_sql, is_autoincrement)."""
    if "@default(autoincrement())" in mods:
        return None, True
    m = re.search(r"@default\((now\(\))\)", mods)
    if m:
        return "DEFAULT CURRENT_TIMESTAMP", False
    m = re.search(r"@default\((cuid\(\)|uuid\(\))\)", mods)
    if m:
        return None, False  # app-side generation
    m = re.search(r"@default\((true|false)\)", mods)
    if m:
        return f"DEFAULT {m.group(1)}", False
    m = re.search(r"@default\((-?\d+(?:\.\d+)?)\)", mods)
    if m:
        return f"DEFAULT {m.group(1)}", False
    # String literal default
    m = re.search(r'@default\("([^"]*)"\)', mods)
    if m:
        escaped = m.group(1).replace("'", "''")
        return f"DEFAULT '{escaped}'", False
    # dbgenerated(...) — pass through
    m = re.search(r"@default\(dbgenerated\((.*?)\)\)", mods)
    if m:
        return f"DEFAULT {m.group(1)}", False
    # json default like @default("[]") but actually it's a Json array — skip
    return None, False


def is_optional(ftype: str, mods: str) -> bool:
    if ftype.endswith("?"):
        return True
    # In Prisma, a relation field with @relation is optional unless it's required;
    # but scalar fields without "?" are NOT NULL by default.
    return False


def is_id(mods: str) -> bool:
    return "@id" in mods


def is_unique(mods: str) -> bool:
    return "@unique" in mods


def is_relation(ftype: str) -> bool:
    """Relation fields like `user User @relation(...)` — the FK column is a separate scalar field."""
    # A relation field's type is a model name (capitalized), not a Prisma primitive.
    # Strip the optional "?" suffix before checking — "DateTime?" must NOT be
    # treated as a relation (it's an optional DateTime scalar).
    base = ftype.rstrip("?")
    if base.endswith("[]"):
        return False
    if base.startswith("Unsupported("):
        return False
    return base not in PRISMA_TO_PG


def render_model_ddl(name: str, fields, block_attrs) -> tuple[list[str], list[str]]:
    """Returns (create_table_stmts, index_stmts)."""
    col_lines = []
    pk_cols = []
    unique_cols = []
    autoincrement_col = None

    for f in fields:
        fname = f["name"]
        ftype = f["type"]
        mods = f["mods"]

        # Skip array back-references
        if ftype.endswith("[]"):
            continue

        # Skip pure relation fields (their FK is a separate scalar field with @relation(fields: ...))
        # But we DO want to keep the FK scalar field itself.
        # Detect: type is a model name AND has @relation WITHOUT `fields:` (i.e., it's the back-reference side)
        if is_relation(ftype) and "@relation" in mods and "fields:" not in mods:
            continue  # back-reference, no column

        # If this is the FK side (has @relation with fields: [scalarCol]) — also skip, since the scalar col itself carries the FK
        if is_relation(ftype) and "@relation" in mods and "fields:" in mods:
            # The relation field is virtual — it points to fields already declared as scalar columns
            continue

        # If type is a model name but no @relation (e.g. enum-like) — treat as TEXT
        if is_relation(ftype):
            pg_type = "TEXT"
        else:
            pg_type = base_type(ftype)
            if pg_type is None:
                continue

        # NULL/NOT NULL
        nullable = is_optional(ftype, mods)
        # If part of PK, it's NOT NULL implicitly
        not_null = "" if nullable else " NOT NULL"
        if is_id(mods):
            not_null = " NOT NULL"
            pk_cols.append(fname)

        # Default
        default_sql, is_autoinc = field_default(mods, pg_type)
        if is_autoinc:
            pg_type = "SERIAL" if pg_type == "INTEGER" else pg_type
            autoincrement_col = fname
            default_clause = ""
        elif default_sql:
            default_clause = f" {default_sql}"
        else:
            default_clause = ""

        col_lines.append(f'  "{fname}" {pg_type}{not_null}{default_clause}')

        if is_unique(mods):
            unique_cols.append(fname)

    # PK constraint
    if pk_cols:
        pk_list = ", ".join(f'"{c}"' for c in pk_cols)
        col_lines.append(f'  CONSTRAINT "{name}_pkey" PRIMARY KEY ({pk_list})')

    create_stmt = (
        f'CREATE TABLE IF NOT EXISTS "{name}" (\n'
        + ",\n".join(col_lines)
        + "\n)"
    )

    # Index statements
    index_stmts = []
    for uc in unique_cols:
        index_stmts.append(
            f'CREATE UNIQUE INDEX IF NOT EXISTS "{name}_{uc}_key" ON "{name}"("{uc}")'
        )

    # Block-level attributes
    for attr in block_attrs:
        # @@unique([a, b, c])
        m = re.match(r"@@unique\(\[([^\]]+)\]\)", attr)
        if m:
            cols = [c.strip() for c in m.group(1).split(",")]
            idx_name = f"{name}_" + "_".join(cols) + "_key"
            cols_sql = ", ".join(f'"{c}"' for c in cols)
            index_stmts.append(
                f'CREATE UNIQUE INDEX IF NOT EXISTS "{idx_name}" ON "{name}"({cols_sql})'
            )
            continue
        # @@index([a, b])
        m = re.match(r"@@index\(\[([^\]]+)\](?:,\s*name:\s*\"([^\"]+)\")?\)", attr)
        if m:
            cols = [c.strip() for c in m.group(1).split(",")]
            custom_name = m.group(2)
            idx_name = custom_name if custom_name else f"{name}_" + "_".join(cols) + "_idx"
            cols_sql = ", ".join(f'"{c}"' for c in cols)
            index_stmts.append(
                f'CREATE INDEX IF NOT EXISTS "{idx_name}" ON "{name}"({cols_sql})'
            )
            continue

    return [create_stmt], index_stmts


def main():
    text = SCHEMA.read_text()
    init_text = INIT_SQL.read_text() if INIT_SQL.exists() else ""
    sync_text = SYNC_JS.read_text() if SYNC_JS.exists() else ""

    # Existing tables (from 0_init + schema-sync.js)
    init_tables = set(re.findall(r'CREATE TABLE "([A-Za-z]+)"', init_text))
    sync_tables = set(re.findall(r'CREATE TABLE IF NOT EXISTS "([A-Za-z]+)"', sync_text))
    existing = init_tables | sync_tables

    all_stmts = []
    skipped = []
    generated = []

    for name, fields, block_attrs in parse_schema(text):
        if name in existing:
            skipped.append(name)
            continue
        creates, indexes = render_model_ddl(name, fields, block_attrs)
        all_stmts.extend(creates)
        all_stmts.extend(indexes)
        generated.append(name)

    # Write a JS module that exports the array
    js_lines = ["/**", " * AUTO-GENERATED by scripts/gen-missing-tables.py", " * Do not edit by hand — re-run the script instead.", " */", "module.exports = ["]
    for s in all_stmts:
        # Escape backticks and ${}
        escaped = s.replace("`", "\\`").replace("${", "\\${")
        js_lines.append(f"  `{escaped}`,")
    js_lines.append("];")
    OUT_JS.write_text("\n".join(js_lines) + "\n")

    print(f"Generated {len(generated)} models, {len(all_stmts)} statements → {OUT_JS}")
    print(f"Skipped (already exist): {len(skipped)}")
    print(f"Generated models: {', '.join(generated[:20])}{'...' if len(generated) > 20 else ''}")


if __name__ == "__main__":
    main()
