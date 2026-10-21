from pathlib import Path

DEFAULT_CATALOG_PATH = Path(__file__).parent / "data" / "food_catalog.csv"
CANCEL_MESSAGE = "Carga cancelada: no se ha escrito nada."


def main(_argv: list[str] | None = None) -> int:
    raise NotImplementedError("not implemented")
