import argparse
import os
from pathlib import Path

from sqlalchemy.engine import make_url

from app import create_app
from extensions import db, embedding_client
from repositories.food_repository import FoodRepository
from scripts.database_target import LOCAL_HOSTS, confirm_remote_write, is_local_host
from services.food_import_service import FoodImportService, UsdaSource, format_summary
from services.usda_csv_reader import UsdaFileError
from unit_of_work.unit_of_work import UnitOfWork

# Para ejecutarlo: python -m scripts.import_usda_foods --foundation <carpeta> --sr-legacy <carpeta>


_LOCAL_HOSTS = LOCAL_HOSTS
_is_local = is_local_host
_confirm = confirm_remote_write


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Importa alimentos de USDA FoodData Central.")
    parser.add_argument("--foundation", type=Path, help="Carpeta del CSV de Foundation")
    parser.add_argument("--sr-legacy", type=Path, help="Carpeta del CSV de SR Legacy")
    parser.add_argument(
        "--yes", action="store_true", help="No pedir confirmación si la base no es local"
    )
    args = parser.parse_args(argv)

    sources = []
    if args.foundation is not None:
        sources.append(UsdaSource("foundation", args.foundation))
    if args.sr_legacy is not None:
        sources.append(UsdaSource("sr_legacy", args.sr_legacy))
    if not sources:
        parser.error("indica al menos una de las opciones --foundation o --sr-legacy")

    app = create_app()
    with app.app_context():
        url = make_url(app.config["SQLALCHEMY_DATABASE_URI"])
        database = url.render_as_string(hide_password=True)
        print(f"Entorno: {os.environ.get('FLASK_ENV', 'development')}")
        print(f"Base de datos: {database}")

        if not args.yes and not _is_local(url.host):
            if not _confirm():
                print("Importación cancelada: no se ha escrito nada.")
                return 1

        service = FoodImportService(
            FoodRepository(db.session), UnitOfWork(db.session), embedding_client
        )
        try:
            summary = service.run(sources)
        except UsdaFileError as error:
            print(str(error))
            return 1
        print(format_summary(summary))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
