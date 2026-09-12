#!/usr/bin/env python3
"""
Generate ALTER TABLE ... ADD COLUMN IF NOT EXISTS statements for every column
that exists in the Prisma schema but is missing from the 0_init migration.

Some tables (Interview, etc.) were defined in 0_init with one set of columns,
then later renamed/extended in the Prisma schema. The original columns stay
(we never drop), but the new columns need to be added so Prisma queries
against the current schema don't fail with "column does not exist".

Output: scripts/_init-table-fixes.js (module.exports = [sql strings])
"""
import re
from pathlib import Path

SCHEMA = Path(__file__).resolve().parent.parent / "prisma" / "schema.prisma"
INIT_SQL = Path(__file__).resolve().parent.parent / "prisma" / "migrations" / "0_init" / "migration.sql"
OUT_JS = Path(__file__).resolve().parent / "_init-table-fixes.js"

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

DEFAULTS = {
    # @default(now()) → DEFAULT CURRENT_TIMESTAMP
    "now()": "DEFAULT CURRENT_TIMESTAMP",
    # @default(cuid()) / @default(uuid()) → no DB-side default (app supplies)
    "cuid()": None,
    "uuid()": None,
    # @default(true|false)
    "true": "DEFAULT true",
    "false": "DEFAULT false",
}


def parse_init_columns(table_name, init_text):
    """Return {col_name: raw_line} for the given table in 0_init."""
    pattern = rf'CREATE TABLE "{re.escape(table_name)}"\s*\((.*?)\)\s*;'
    m = re.search(pattern, init_text, re.DOTALL)
    if not m:
        return None  # table not in 0_init
    cols = {}
    for line in m.group(1).splitlines():
        line = line.strip().strip(",").strip()
        if not line or line.startswith("--") or line.startswith("CONSTRAINT"):
            continue
        first_token = line.split()[0].strip('"')
        cols[first_token] = line
    return cols


def parse_prisma_model(name, schema_text):
    """Return list of (field_name, pg_type, default_sql, is_nullable) for the model."""
    pattern = rf'^model\s+{re.escape(name)}\s*\{{(.*?)^\}}'
    m = re.search(pattern, schema_text, re.MULTILINE | re.DOTALL)
    if not m:
        return None
    fields = []
    for line in m.group(1).splitlines():
        line = line.strip()
        if not line or line.startswith("//") or line.startswith("@@") or line.startswith("@"):
            continue
        parts = line.split()
        if len(parts) < 2 or parts[0].startswith("@"):
            continue
        fname = parts[0]
        ftype = parts[1]
        mods = " ".join(parts[2:])
        if ftype.endswith("[]"):
            continue
        base = ftype.rstrip("?")
        if base not in PRISMA_TO_PG:
            continue  # relation field, skip
        pg_type = PRISMA_TO_PG[base]
        is_nullable = ftype.endswith("?")

        # Default
        default_sql = None
        m_def = re.search(r"@default\((now\(\))\)", mods)
        if m_def:
            default_sql = "DEFAULT CURRENT_TIMESTAMP"
        elif re.search(r"@default\((cuid\(\)|uuid\(\))\)", mods):
            default_sql = None
        elif re.search(r"@default\((true|false)\)", mods):
            m_bool = re.search(r"@default\((true|false)\)", mods)
            default_sql = f"DEFAULT {m_bool.group(1)}"
        elif re.search(r"@default\((-?\d+(?:\.\d+)?)\)", mods):
            m_num = re.search(r"@default\((-?\d+(?:\.\d+)?)\)", mods)
            default_sql = f"DEFAULT {m_num.group(1)}"
        elif re.search(r'@default\("([^"]*)"\)', mods):
            m_str = re.search(r'@default\("([^"]*)"\)', mods)
            escaped = m_str.group(1).replace("'", "''")
            default_sql = f"DEFAULT '{escaped}'"

        fields.append((fname, pg_type, default_sql, is_nullable))
    return fields


def main():
    schema_text = SCHEMA.read_text()
    init_text = INIT_SQL.read_text() if INIT_SQL.exists() else ""

    # Find all models in the Prisma schema
    all_models = re.findall(r'^model\s+(\w+)\s*\{', schema_text, re.MULTILINE)

    statements = []
    for model in all_models:
        init_cols = parse_init_columns(model, init_text)
        if init_cols is None:
            continue  # not in 0_init, skip
        prisma_fields = parse_prisma_model(model, schema_text)
        if not prisma_fields:
            continue

        for fname, pg_type, default_sql, is_nullable in prisma_fields:
            if fname in init_cols:
                continue  # column already exists in 0_init
            # Add ALTER TABLE ADD COLUMN IF NOT EXISTS
            null_clause = "" if is_nullable else " NOT NULL"
            default_clause = f" {default_sql}" if default_sql else ""
            # For NOT NULL columns without a default, we can't add them to a
            # non-empty table. Use a safe default or make them nullable.
            if not is_nullable and not default_sql:
                # Force nullable to avoid breaking existing rows
                null_clause = ""
                default_clause = ""
            stmt = f'ALTER TABLE "{model}" ADD COLUMN IF NOT EXISTS "{fname}" {pg_type}{null_clause}{default_clause}'
            statements.append(stmt)

    # Write JS module
    js_lines = ["/**", " * AUTO-GENERATED by scripts/gen-init-table-fixes.py", " * Do not edit by hand — re-run the script instead.", " */", "module.exports = ["]
    for s in statements:
        escaped = s.replace("`", "\\`").replace("${", "\\${")
        js_lines.append(f"  `{escaped}`,")
    js_lines.append("];")
    OUT_JS.write_text("\n".join(js_lines) + "\n")
    print(f"Generated {len(statements)} ALTER statements → {OUT_JS}")


if __name__ == '__main__':
    main()
