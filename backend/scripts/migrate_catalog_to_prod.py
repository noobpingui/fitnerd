# Migra el catalogo de ejercicios (body_regions, exercise_categories,
# exercises) y el corpus del coach IA (videos, transcript_chunks, con sus
# embeddings) desde la base de datos local (DEV_DATABASE_URL) hacia la base
# de datos real de produccion en Supabase (PROD_DATABASE_URL).
#
# NO migra: users, exercise_favorites, weekly_plan_entries, body_metrics,
# feedback, progress_analyses - son datos generados por usuarios reales,
# cada entorno (local/produccion) debe tener los suyos propios, no una
# copia de los de desarrollo.
#
# Es seguro correrlo mas de una vez: usa session.merge() (upsert por PK),
# asi que si una fila ya existe en produccion con el mismo id, se
# actualiza en vez de duplicarse - no rompe si se corta a la mitad y se
# vuelve a correr.
#
# Uso (desde backend/, con el venv activado):
#     python -m scripts.migrate_catalog_to_prod

from dotenv import load_dotenv
import os

from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

load_dotenv()

from models.body_region import BodyRegion
from models.exercise_category import ExerciseCategory
from models.exercise import Exercise
from models.video import Video
from models.transcript import TranscriptChunk

# Orden importante: cada tabla debe copiarse despues de las tablas de las
# que depende via foreign key (body_regions antes que exercise_categories
# antes que exercises; videos antes que transcript_chunks) - si no, la
# fila hija fallaria al insertarse porque el id que referencia todavia no
# existe del lado de produccion.
TABLES_IN_ORDER = [
    BodyRegion,
    ExerciseCategory,
    Exercise,
    Video,
    TranscriptChunk,
]


def build_session(url_env_var: str):
    url = os.getenv(url_env_var)
    if not url:
        raise RuntimeError(f"{url_env_var} no esta definida en backend/.env")
    engine = create_engine(url)
    return sessionmaker(bind=engine)()


def migrate():
    dev_session = build_session("DEV_DATABASE_URL")
    prod_session = build_session("PROD_DATABASE_URL")

    try:
        for Model in TABLES_IN_ORDER:
            rows = dev_session.execute(select(Model)).scalars().all()
            # Los "despegamos" de dev_session para poder mergearlos en
            # prod_session sin que las dos sesiones se pisen.
            for row in rows:
                dev_session.expunge(row)

            for row in rows:
                prod_session.merge(row)
            prod_session.commit()

            print(f"{Model.__tablename__}: {len(rows)} filas migradas")

    finally:
        dev_session.close()
        prod_session.close()


if __name__ == "__main__":
    migrate()
