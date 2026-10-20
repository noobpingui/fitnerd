"""Tests del script `scripts.import_usda_foods` (spec 021, importación a mano):
confirmación antes de escribir en una base que no es local.

Ningún test toca una base real: `create_app` se sustituye por una app falsa
con la URL que cada test indica (nunca una URL de producción real) y
`FoodImportService` por un doble que solo registra las llamadas.
"""

from contextlib import nullcontext
from pathlib import Path

import pytest

from scripts import import_usda_foods

LOCAL_URL = "postgresql://user:secret@localhost:5433/fitnerd_dev"
REMOTE_URL = "postgresql://user:secret@db.ejemplo.invalid:5432/fitnerd"


class FakeApp:
    def __init__(self, uri):
        self.config = {"SQLALCHEMY_DATABASE_URI": uri}

    def app_context(self):
        return nullcontext()


class FakeImportService:
    """Doble escrito a mano: registra construcciones y ejecuciones."""

    instances = []

    def __init__(self, repository, unit_of_work, embedding_client):
        self.run_calls = []
        FakeImportService.instances.append(self)

    def run(self, sources):
        self.run_calls.append(sources)
        return "resumen-falso"


class FakeFoodRepository:
    def __init__(self, session):
        self.session = session


class FakeUnitOfWork:
    def __init__(self, session):
        self.session = session


@pytest.fixture
def script(monkeypatch):
    """Instala los dobles en el módulo del script y devuelve un ayudante
    `run(uri, argv, answers)` que devuelve (código, entradas pedidas)."""
    FakeImportService.instances = []
    monkeypatch.setattr(import_usda_foods, "FoodImportService", FakeImportService)
    monkeypatch.setattr(import_usda_foods, "FoodRepository", FakeFoodRepository)
    monkeypatch.setattr(import_usda_foods, "UnitOfWork", FakeUnitOfWork)
    monkeypatch.setattr(import_usda_foods, "format_summary", lambda summary: str(summary))

    def run(uri, argv, answer=None, eof=False):
        monkeypatch.setattr(import_usda_foods, "create_app", lambda *a, **k: FakeApp(uri))
        prompts = []

        def fake_input(prompt=""):
            prompts.append(prompt)
            if eof:
                raise EOFError
            return answer

        monkeypatch.setattr("builtins.input", fake_input)
        code = import_usda_foods.main(argv)
        return code, prompts

    return run


ARGV = ["--foundation", str(Path("carpeta-falsa"))]


def total_runs():
    return sum(len(service.run_calls) for service in FakeImportService.instances)


# SDD: 021 REQ-001 AC-001.9
def test_host_no_local_responder_n_cancela_sin_importar(script):
    code, prompts = script(REMOTE_URL, ARGV, answer="n")

    assert code == 1
    assert len(prompts) == 1
    assert total_runs() == 0
    assert FakeImportService.instances == []


# SDD: 021 REQ-001 AC-001.9
def test_host_no_local_respuesta_vacia_cancela(script):
    code, _ = script(REMOTE_URL, ARGV, answer="")

    assert code == 1
    assert FakeImportService.instances == []


# SDD: 021 REQ-001 AC-001.9
def test_host_no_local_eof_cancela_sin_importar(script):
    code, prompts = script(REMOTE_URL, ARGV, eof=True)

    assert code == 1
    assert len(prompts) == 1
    assert FakeImportService.instances == []


# SDD: 021 REQ-001 AC-001.8
@pytest.mark.parametrize("answer", ["s", "S", "sí", "si"])
def test_host_no_local_responder_s_continua(script, answer):
    code, prompts = script(REMOTE_URL, ARGV, answer=answer)

    assert code == 0
    assert len(prompts) == 1
    assert total_runs() == 1


# SDD: 021 REQ-001 AC-001.10
def test_host_no_local_con_yes_continua_sin_preguntar(script):
    code, prompts = script(REMOTE_URL, ARGV + ["--yes"], answer="n")

    assert code == 0
    assert prompts == []
    assert total_runs() == 1


# SDD: 021 REQ-001 AC-001.11
@pytest.mark.parametrize(
    "host", ["localhost", "127.0.0.1", "[::1]", "postgres", "LOCALHOST"]
)
def test_host_local_no_pregunta(script, host):
    uri = f"postgresql://user:secret@{host}:5433/fitnerd_dev"

    code, prompts = script(uri, ARGV, answer="n")

    assert code == 0
    assert prompts == []
    assert total_runs() == 1


# SDD: 021 REQ-001 AC-001.12
def test_url_sin_host_se_trata_como_no_local(script):
    code, prompts = script("postgresql:///fitnerd", ARGV, answer="n")

    assert code == 1
    assert len(prompts) == 1
    assert FakeImportService.instances == []


# SDD: 021 REQ-001 AC-001.12
def test_host_desconocido_se_trata_como_no_local(script):
    code, prompts = script("postgresql://user:secret@servidor-raro:5432/x", ARGV, answer="n")

    assert code == 1
    assert len(prompts) == 1
    assert FakeImportService.instances == []


# SDD: 021 REQ-001 AC-001.8
@pytest.mark.parametrize("answer", ["y", "Y", "yes", "YES"])
def test_host_no_local_responder_y_o_yes_continua(script, answer):
    code, prompts = script(REMOTE_URL, ARGV, answer=answer)

    assert code == 0
    assert len(prompts) == 1
    assert total_runs() == 1
