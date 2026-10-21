CATALOG_ID_LENGTH = (2, 60)
CATALOG_NAME_LENGTH = (2, 80)
SYNONYM_LENGTH = (2, 80)
CALORIES_RANGE = (0, 900)
MACRO_RANGE = (0, 100)
FORBIDDEN_NAME_WORDS: tuple[str, ...] = ("con", "frito", "frita", "fritos", "fritas")
MIN_REDUCED_FORM_LENGTH = 3


def is_catalog_id(_value: object) -> bool:
    raise NotImplementedError("not implemented")


def fold(_text: str) -> str:
    raise NotImplementedError("not implemented")


def words(_text: str) -> list[str]:
    raise NotImplementedError("not implemented")


def term_key(_text: str) -> str:
    raise NotImplementedError("not implemented")


def word_forms(_word: str) -> tuple[str, ...]:
    raise NotImplementedError("not implemented")
