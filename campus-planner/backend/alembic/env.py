import os
import sys
from logging.config import fileConfig

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from alembic import context
from sqlalchemy import create_engine

from app import models  # noqa: F401
from app.config import DATABASE_URL
from app.database import Base

config = context.config
if config.config_file_name:
    fileConfig(config.config_file_name)


def run() -> None:
    engine = create_engine(DATABASE_URL)
    with engine.connect() as conn:
        context.configure(connection=conn, target_metadata=Base.metadata, compare_type=True,
                          render_as_batch=DATABASE_URL.startswith("sqlite"))
        with context.begin_transaction():
            context.run_migrations()


run()
