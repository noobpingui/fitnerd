"""Tests del script `scripts.load_food_catalog` (spec 023, carga a mano del
catálogo): confirmación antes de escribir en una base que no es local.

Ningún test toca una base real: `create_app` se sustituye por una app falsa con
la URL que cada test indica (nunca una URL real) y `CatalogLoadService` por un
doble que solo registra las llamadas. Se usa `monkeypatch` porque el script es
el punto de entrada de la línea de comandos y no recibe dependencias por
constructor (excepción justificada en la sección 5 del plan).
"""

from contextlib import nullcontext
from pathlib import Path

import pytest

from scripts import database_target, load_food_catalog
from services.catalog_csv_reader import CatalogFileError

LOCAL_URL = "postgresql://user:secret@localhost:5433/fitnerd_dev"
REMOTE_URL = "postgresql://user:secret@db.ejemplo.invalid:5432/fitnerd"

CONFIRM_PROMPT = "La base de datos NO es local. ¿Escribir en ella? [s/N]: "
CANCEL_MESSAGE = "Carga cancelada: no se ha escrito nada."


class FakeApp:
    def __init__(self, uri):
        self.config = {"SQLALCHEMY_DATABASE_URI": uri}

    def app_context(self):
        return nullcontext()


class FakeLoadService:
    """Doble escrito a mano: registra construcciones y ejecuciones."""

    instances = []
    error = None

    def __init__(self, catalog_repository, food_repository, unit_of_work):
        self.run_calls = []
        FakeLoadService.instances.append(self)

    def run(self, path):
        self.run_calls.append(path)
        if FakeLoadService.error is not None:
            raise FakeLoadService.error
        return "resumen-falso"


class FakeRepository:
    def __init__(self, session):
        self.session = session


class FakeUnitOfWork:
    def __init__(self, session):
        self.session = session


@pytest.fixture
def script(monkeypatch):
    """Instala los dobles en el módulo del script y devuelve un ayudante
    `run(uri, argv, answer, eof)` que devuelve (código, entradas pedidas).
    `raising=False` hace que, antes de la implementación, el fallo sea el de
    comportamiento (`main` no implementado) y no un error del propio test."""
    FakeLoadService.instances = []
    FakeLoadService.error = None
    monkeypatch.setattr(load_food_catalog, "CatalogLoadService", FakeLoadService, raising=False)
    monkeypatch.setattr(load_food_catalog, "CatalogFoodRepository", FakeRepository, raising=False)
    monkeypatch.setattr(load_food_catalog, "FoodRepository", FakeRepository, raising=False)
    monkeypatch.setattr(load_food_catalog, "UnitOfWork", FakeUnitOfWork, raising=False)
    monkeypatch.setattr(
        load_food_catalog, "format_catalog_summary", lambda summary: str(summary), raising=False
    )

    def run(uri, argv=(), answer=None, eof=False):
        monkeypatch.setattr(
            load_food_catalog, "create_app", lambda *a, **k: FakeApp(uri), raising=False
        )
        prompts = []

        def fake_input(prompt=""):
            prompts.append(prompt)
            if eof:
                raise EOFError
            return answer

        monkeypatch.setattr("builtins.input", fake_input)
        code = load_food_catalog.main(list(argv))
        return code, prompts

    return run


def total_runs():
    return sum(len(service.run_calls) for service in FakeLoadService.instances)


# --------------------------------------------------------------------------
# AC-002.5: base no local
# --------------------------------------------------------------------------


# SDD: 023 REQ-002 AC-002.5
def test_remote_host_answering_n_cancels_without_loading(script, capsys):
    """Responder «n»: código 1, un aviso, mensaje de cancelación y el servicio ni se construye."""
    code, prompts = script(REMOTE_URL, answer="n")

    assert code == 1
    assert prompts == [CONFIRM_PROMPT]
    assert FakeLoadService.instances == []
    assert CANCEL_MESSAGE in capsys.readouterr().out


# SDD: 023 REQ-002 AC-002.5
def test_remote_host_with_an_empty_answer_cancels(script):
    """Respuesta vacía: se cancela."""
    code, prompts = script(REMOTE_URL, answer="")

    assert code == 1
    assert len(prompts) == 1
    assert FakeLoadService.instances == []


# SDD: 023 REQ-002 AC-002.5
def test_remote_host_without_interactive_input_cancels(script):
    """Sin entrada interactiva (`EOFError`): se cancela."""
    code, prompts = script(REMOTE_URL, eof=True)

    assert code == 1
    assert len(prompts) == 1
    assert FakeLoadService.instances == []


# SDD: 023 REQ-002 AC-002.5
@pytest.mark.parametrize("answer", ["s", "S", "sí", "si", "y", "Y", "yes", "YES"])
def test_remote_host_with_an_affirmative_answer_loads(script, answer):
    """«s», «sí», «y», «yes» (en cualquier caja): la carga se ejecuta con código 0."""
    code, prompts = script(REMOTE_URL, answer=answer)

    assert code == 0
    assert len(prompts) == 1
    assert total_runs() == 1


# SDD: 023 REQ-002 AC-002.5
@pytest.mark.parametrize("answer", ["no", "quizás", "ss", "n"])
def test_remote_host_with_a_non_affirmative_answer_cancels(script, answer):
    """Cualquier respuesta que no sea afirmativa cancela."""
    code, _ = script(REMOTE_URL, answer=answer)

    assert code == 1
    assert FakeLoadService.instances == []


# SDD: 023 REQ-002 AC-002.5
def test_a_url_without_host_or_with_an_unknown_host_is_treated_as_remote(script):
    """Ante la duda, no local: se pregunta."""
    code_without_host, prompts_without_host = script("postgresql:///fitnerd", answer="n")
    code_unknown, prompts_unknown = script(
        "postgresql://user:secret@servidor-raro:5432/x", answer="n"
    )

    assert (code_without_host, code_unknown) == (1, 1)
    assert len(prompts_without_host) == 1 and len(prompts_unknown) == 1


# --------------------------------------------------------------------------
# AC-002.6: base local o --yes
# --------------------------------------------------------------------------


# SDD: 023 REQ-002 AC-002.6
@pytest.mark.parametrize("host", ["localhost", "127.0.0.1", "[::1]", "postgres", "LOCALHOST"])
def test_local_host_does_not_ask(script, host):
    """Host local: no se pide confirmación y se carga."""
    code, prompts = script(f"postgresql://user:secret@{host}:5433/fitnerd_dev", answer="n")

    assert code == 0
    assert prompts == []
    assert total_runs() == 1


# SDD: 023 REQ-002 AC-002.6
def test_remote_host_with_yes_does_not_ask(script):
    """`--yes` evita la pregunta aunque la base no sea local."""
    code, prompts = script(REMOTE_URL, ["--yes"], answer="n")

    assert code == 0
    assert prompts == []
    assert total_runs() == 1


# --------------------------------------------------------------------------
# Ejecución
# --------------------------------------------------------------------------


# SDD: 023 REQ-002 AC-002.6
def test_without_a_path_it_loads_the_default_csv(script):
    """Sin argumento posicional se pasa `DEFAULT_CATALOG_PATH` al servicio."""
    script(LOCAL_URL)

    (path,) = FakeLoadService.instances[0].run_calls
    assert Path(path).parts[-3:] == ("scripts", "data", "food_catalog.csv")


# SDD: 023 REQ-002 AC-002.6
def test_with_a_path_it_loads_that_file(script):
    """La ruta indicada llega al servicio."""
    script(LOCAL_URL, ["otro-catalogo.csv"])

    assert [Path(p) for p in FakeLoadService.instances[0].run_calls] == [Path("otro-catalogo.csv")]


# SDD: 023 REQ-002 AC-002.6
def test_the_summary_and_the_target_database_are_printed_without_the_password(script, capsys):
    """Se imprime el entorno, la base (sin contraseña) y el resumen."""
    code, _ = script(LOCAL_URL)

    out = capsys.readouterr().out
    assert code == 0
    assert "Entorno:" in out
    assert "Base de datos:" in out
    assert "localhost:5433/fitnerd_dev" in out
    assert "secret" not in out
    assert "resumen-falso" in out


# SDD: 023 REQ-003 AC-003.1
def test_a_catalog_file_error_is_printed_and_returns_1(script, capsys):
    """`CatalogFileError`: se imprime su mensaje y el código es 1."""
    FakeLoadService.error = CatalogFileError(Path("x.csv"), "No se encontró el archivo x.csv.")

    code, _ = script(LOCAL_URL, ["x.csv"])

    assert code == 1
    assert "No se encontró el archivo x.csv." in capsys.readouterr().out


# --------------------------------------------------------------------------
# database_target (compartido con la importación de USDA)
# --------------------------------------------------------------------------


# SDD: 023 REQ-002 AC-002.6
@pytest.mark.parametrize(
    "host, expected",
    [
        ("localhost", True),
        ("LocalHost", True),
        ("127.0.0.1", True),
        ("::1", True),
        ("postgres", True),
        (None, False),
        ("", False),
        ("db.ejemplo.invalid", False),
        ("localhost.evil.com", False),
    ],
)
def test_is_local_host(host, expected):
    """Solo los hosts locales (sin distinguir mayúsculas); sin host, no."""
    assert database_target.is_local_host(host) is expected


# SDD: 023 REQ-002 AC-002.5
@pytest.mark.parametrize(
    "answer, expected",
    [("s", True), (" Sí ", True), ("YES", True), ("y", True), ("n", False), ("", False), ("x", False)],
)
def test_confirm_remote_write_reads_the_answer(monkeypatch, answer, expected):
    """Respuestas afirmativas (con espacios y cualquier caja) confirman; el resto no."""
    prompts = []

    def fake_input(prompt=""):
        prompts.append(prompt)
        return answer

    monkeypatch.setattr("builtins.input", fake_input)

    assert database_target.confirm_remote_write() is expected
    assert prompts == [CONFIRM_PROMPT]


# SDD: 023 REQ-002 AC-002.5
def test_confirm_remote_write_without_input_is_false(monkeypatch):
    """Sin entrada interactiva (`EOFError`) no se confirma."""

    def fake_input(prompt=""):
        raise EOFError

    monkeypatch.setattr("builtins.input", fake_input)

    assert database_target.confirm_remote_write() is False
