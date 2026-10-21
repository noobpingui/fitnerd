import argparse
import os
from pathlib import Path

from sqlalchemy.engine import make_url

from app import create_app
from extensions import db
from repositories.catalog_food_repository import CatalogFoodRepository
from repositories.food_repository import FoodRepository
from scripts.database_target import confirm_remote_write, is_local_host
from services.catalog_csv_reader import CatalogFileError
from services.catalog_load_service import CatalogLoadService, format_catalog_summary
from unit_of_work.unit_of_work import UnitOfWork

# Para ejecutarlo: python -m scripts.load_food_catalog [RUTA_CSV] [--yes]

DEFAULT_CATALOG_PATH = Path(__file__).parent / "data" / "food_catalog.csv"
CANCEL_MESSAGE = "Carga cancelada: no se ha escrito nada."


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Carga el catálogo de alimentos desde un CSV.")
    parser.add_argument(
        "csv_path",
        nargs="?",
        type=Path,
        default=DEFAULT_CATALOG_PATH,
        help="Ruta del CSV del catálogo (por defecto, el del repositorio)",
    )
    parser.add_argument(
        "--yes", action="store_true", help="No pedir confirmación si la base no es local"
    )
    args = parser.parse_args(argv)

    app = create_app()
    with app.app_context():
        url = make_url(app.config["SQLALCHEMY_DATABASE_URI"])
        database = url.render_as_string(hide_password=True)
        print(f"Entorno: {os.environ.get('FLASK_ENV', 'development')}")
        print(f"Base de datos: {database}")

        if not args.yes and not is_local_host(url.host):
            if not confirm_remote_write():
                print(CANCEL_MESSAGE)
                return 1

        service = CatalogLoadService(
            CatalogFoodRepository(db.session), FoodRepository(db.session), UnitOfWork(db.session)
        )
        try:
            summary = service.run(args.csv_path)
        except CatalogFileError as error:
            print(str(error))
            return 1
        print(format_catalog_summary(summary))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
