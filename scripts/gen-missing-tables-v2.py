#!/usr/bin/env python3
"""
Generates CREATE TABLE / INDEX statements for ALL models in prisma/schema.prisma
that are NOT already present in scripts/_generated-tables.js.

Reads schema.prisma, parses `model Foo { ... }` blocks, converts field types to
Postgres DDL (with hardcoded Prisma → PG type mapping), and appends to
_generated-tables.js.

Idempotent: skips models whose CREATE TABLE is already in the JS file.
"""

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCHEMA = ROOT / "prisma" / "schema.prisma"
OUT_JS = Path(__file__).resolve().parent / "_generated-tables.js"

# Prisma scalar → Postgres column type
TYPE_MAP = {
    "String": "TEXT",
    "Int": "INTEGER",
    "BigInt": "BIGINT",
    "Float": "DOUBLE PRECISION",
    "Boolean": "BOOLEAN",
    "DateTime": "TIMESTAMP(3)",
    "Json": "JSONB",
    "Bytes": "BYTEA",
    "Decimal": "DECIMAL(65,30)",
}

# Map Prisma model name → table name (Prisma uses double-quoted model name as table name)
def model_to_table(name: str) -> str:
    return name  # Prisma default = model name verbatim

def quote_ident(name: str) -> str:
    return f'"{name}"'

def parse_schema(text: str):
    """Yield (model_name, lines) for each model block."""
    pattern = re.compile(r"^model\s+(\w+)\s*\{(.*?)^\}", re.MULTILINE | re.DOTALL)
    for m in pattern.finditer(text):
        name = m.group(1)
        body = m.group(2)
        yield name, body

def parse_fields(body: str):
    """Return list of (field_name, prisma_type, is_required, is_id, default_expr, is_relation, db_text)."""
    fields = []
    for line in body.splitlines():
        line = line.strip()
        if not line or line.startswith("//") or line.startswith("@@"):
            continue
        # Skip closing brace
        if line == "}":
            continue
        # Match: fieldName Type? @id @default(...) @db.Text etc.
        # Skip relation fields (Type starts with uppercase and is a model name — heuristic).
        m = re.match(r"^(\w+)\s+([\w\?]+)(.*)$", line)
        if not m:
            continue
        fname = m.group(1)
        ftype_raw = m.group(2)
        rest = m.group(3)

        is_required = not ftype_raw.endswith("?")
        ftype = ftype_raw.rstrip("?")

        is_id = "@id" in rest
        default_match = re.search(r"@default\(([^)]*)\)", rest)
        default_expr = default_match.group(1).strip() if default_match else None
        db_text_match = re.search(r"@db\.(\w+)", rest)
        db_text = db_text_match.group(1) if db_text_match else None

        is_relation = False
        if ftype not in TYPE_MAP:
            # Either relation (model name) or enum
            # Treat enum-like scalars as TEXT (Prisma enums are TEXT in DB)
            # Heuristic: if name starts with uppercase and not in TYPE_MAP, it's a relation or enum.
            if ftype[0].isupper():
                # Could be enum — check if rest has @relation
                if "@relation" in rest:
                    is_relation = True
                # else: enum → store as TEXT
        fields.append((fname, ftype, is_required, is_id, default_expr, is_relation, db_text))
    return fields

def parse_indexes(body: str):
    """Return list of index directives: (fields, name?)."""
    indexes = []
    for m in re.finditer(r"@@index\((\[([^\]]+)\])(?:\s*,\s*name:\s*\"([^\"]+)\))?\)", body):
        fields_str = m.group(2)
        name = m.group(3)
        fields = [f.strip().strip('"') for f in fields_str.split(",")]
        indexes.append((fields, name))
    return indexes

def parse_unique(body: str):
    """Return list of unique constraints: (fields, name?)."""
    uniques = []
    for m in re.finditer(r"@@unique\((\[([^\]]+)\])(?:\s*,\s*name:\s*\"([^\"]+)\))?\)", body):
        fields_str = m.group(2)
        name = m.group(3)
        fields = [f.strip().strip('"') for f in fields_str.split(",")]
        uniques.append((fields, name))
    return uniques

def map_default(default_expr: str, pg_type: str) -> str:
    """Convert Prisma default expression to PG default."""
    if default_expr is None:
        return None
    if default_expr.startswith("now()"):
        return "CURRENT_TIMESTAMP"
    if default_expr.startswith("cuid()"):
        return None  # We'll let app side generate cuid; column is TEXT
    if default_expr.startswith("uuid()"):
        return None
    if default_expr.startswith("autoincrement()"):
        return None  # SERIAL handled separately
    if default_expr.startswith("\"") or default_expr.startswith("'"):
        return default_expr
    # numeric default
    return default_expr

def emit_create_table(model_name: str, fields, uniques) -> str:
    cols = []
    pk_cols = []
    for (fname, ftype, is_required, is_id, default_expr, is_relation, db_text) in fields:
        if is_relation:
            continue  # Relation fields don't generate columns
        # Determine PG type
        if ftype in TYPE_MAP:
            pg_type = TYPE_MAP[ftype]
            if db_text:
                # Override with @db.Text (Postgres TEXT)
                pg_type = "TEXT"
        else:
            # Enum — store as TEXT
            pg_type = "TEXT"
        col_def = f"{quote_ident(fname)} {pg_type}"
        if is_id:
            col_def += " NOT NULL"
            pk_cols.append(fname)
        else:
            if is_required:
                col_def += " NOT NULL"
            if default_expr:
                pg_default = map_default(default_expr, pg_type)
                if pg_default is not None:
                    col_def += f" DEFAULT {pg_default}"
        cols.append("  " + col_def)
    # Primary key
    if pk_cols:
        pk_fields = ", ".join(quote_ident(c) for c in pk_cols)
        cols.append(f"  CONSTRAINT {quote_ident(model_name + '_pkey')} PRIMARY KEY ({pk_fields})")
    # Unique constraints
    for (ufields, uname) in uniques:
        ucols = ", ".join(quote_ident(c) for c in ufields)
        if uname:
            cols.append(f"  CONSTRAINT {quote_ident(uname)} UNIQUE ({ucols})")
        else:
            # Auto-name: Model_field1_field2_key
            auto_name = f"{model_name}_" + "_".join(ufields) + "_key"
            cols.append(f"  CONSTRAINT {quote_ident(auto_name)} UNIQUE ({ucols})")
    return (
        f"CREATE TABLE IF NOT EXISTS {quote_ident(model_name)} (\n"
        + ",\n".join(cols)
        + "\n)"
    )

def emit_indexes(model_name: str, indexes) -> list:
    out = []
    for (ifields, iname) in indexes:
        cols = ", ".join(quote_ident(c) for c in ifields)
        if iname:
            name = iname
        else:
            name = f"{model_name}_" + "_".join(ifields) + "_idx"
        out.append(f"CREATE INDEX IF NOT EXISTS {quote_ident(name)} ON {quote_ident(model_name)}({cols})")
    return out

def emit_unique_indexes(model_name: str, uniques) -> list:
    out = []
    for (ufields, uname) in uniques:
        cols = ", ".join(quote_ident(c) for c in ufields)
        if uname:
            name = uname
        else:
            name = f"{model_name}_" + "_".join(ufields) + "_key"
        out.append(f"CREATE UNIQUE INDEX IF NOT EXISTS {quote_ident(name)} ON {quote_ident(model_name)}({cols})")
    return out

def main():
    text = SCHEMA.read_text()
    existing = OUT_JS.read_text() if OUT_JS.exists() else ""
    existing_models = set(re.findall(r'CREATE TABLE IF NOT EXISTS "(\w+)"', existing))

    new_statements = []
    new_models_added = []
    for model_name, body in parse_schema(text):
        if model_name in existing_models:
            continue
        fields = parse_fields(body)
        indexes = parse_indexes(body)
        uniques = parse_unique(body)
        new_statements.append(emit_create_table(model_name, fields, uniques))
        new_statements.extend(emit_unique_indexes(model_name, uniques))
        new_statements.extend(emit_indexes(model_name, indexes))
        new_models_added.append(model_name)

    if not new_statements:
        print("[gen-missing-tables-v2] No new models to add.")
        return

    # Build JS snippet
    js_lines = []
    for s in new_statements:
        # Escape backticks and ${}
        escaped = s.replace("`", "\\`").replace("${", "\\${")
        js_lines.append(f"  `{escaped}`,")
    js_snippet = "\n".join(js_lines)

    # Append before the closing `];`
    if existing.endswith("];\n"):
        new_content = existing[:-3] + js_snippet + "\n];\n"
    elif existing.endswith("];"):
        new_content = existing[:-2] + js_snippet + "\n];\n"
    else:
        new_content = existing + "\n" + js_snippet + "\n];\n"

    OUT_JS.write_text(new_content)
    print(f"[gen-missing-tables-v2] Added {len(new_models_added)} new models:")
    for m in new_models_added:
        print(f"  - {m}")
    print(f"[gen-missing-tables-v2] Total statements added: {len(new_statements)}")

if __name__ == "__main__":
    main()
