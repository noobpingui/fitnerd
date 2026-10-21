import re
import unicodedata

CATALOG_ID_LENGTH = (2, 60)
CATALOG_NAME_LENGTH = (2, 80)
SYNONYM_LENGTH = (2, 80)
CALORIES_RANGE = (0, 900)
MACRO_RANGE = (0, 100)
FORBIDDEN_NAME_WORDS: tuple[str, ...] = ("con", "frito", "frita", "fritos", "fritas")
MIN_REDUCED_FORM_LENGTH = 3

_ID_PATTERN = re.compile(r"[a-z0-9]+(-[a-z0-9]+)*")
_WORD_PATTERN = re.compile(r"[a-z0-9]+")


def is_catalog_id(value: object) -> bool:
    if not isinstance(value, str):
        return False
    low, high = CATALOG_ID_LENGTH
    return low <= len(value) <= high and _ID_PATTERN.fullmatch(value) is not None


def fold(text: str) -> str:
    # NFKD separa la letra de su marca (tilde, diéresis, virgulilla de la «ñ»).
    decomposed = unicodedata.normalize("NFKD", text.casefold())
    return "".join(char for char in decomposed if not unicodedata.combining(char))


def words(text: str) -> list[str]:
    return _WORD_PATTERN.findall(fold(text))


def term_key(text: str) -> str:
    return " ".join(words(text))


def word_forms(word: str) -> tuple[str, ...]:
    candidates = [word]
    if word.endswith("s"):
        candidates.append(word[:-1])
    if word.endswith("es"):
        candidates.append(word[:-2])
    forms: list[str] = []
    for index, candidate in enumerate(candidates):
        if index > 0 and len(candidate) < MIN_REDUCED_FORM_LENGTH:
            continue
        if candidate not in forms:
            forms.append(candidate)
    return tuple(forms)
