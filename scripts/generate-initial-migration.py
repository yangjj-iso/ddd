"""One-time development helper: freeze the initial model metadata into concrete Alembic DDL."""

import sys
from pathlib import Path
from alembic.autogenerate import render_python_code
from alembic.operations.ops import (
    CreateTableOp,
    DropTableOp,
    CreateIndexOp,
    DropIndexOp,
    UpgradeOps,
    DowngradeOps,
)

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / "backend"))
from app.db import Base
from app import models  # noqa: E402, F401

tables = Base.metadata.sorted_tables
upgrades = []
downgrades = []
for table in tables:
    upgrades.append(CreateTableOp.from_table(table))
    upgrades.extend(CreateIndexOp.from_index(index) for index in table.indexes)
for table in reversed(tables):
    downgrades.extend(DropIndexOp.from_index(index) for index in table.indexes)
    downgrades.append(DropTableOp.from_table(table))
up = render_python_code(UpgradeOps(upgrades))
down = render_python_code(DowngradeOps(downgrades))
target = root / "backend/alembic/versions/0001_initial.py"
target.parent.mkdir(parents=True, exist_ok=True)
if target.exists():
    raise RuntimeError(
        "Initial migration already frozen; append a new migration instead"
    )
target.write_text(
    '"""Initial PartsBox schema. No runtime seeding."""\nfrom alembic import op\nimport sqlalchemy as sa\n\nrevision = "0001_initial"\ndown_revision = None\nbranch_labels = None\ndepends_on = None\n\ndef upgrade():\n'
    + up
    + "\n\ndef downgrade():\n"
    + down
    + "\n",
    encoding="utf-8",
)
print("Frozen initial migration created.")
