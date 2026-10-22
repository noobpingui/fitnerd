"""Test de configuración del despliegue (spec 024): comprueba el `CMD` de
gunicorn del `Dockerfile` del backend, no ningún servicio. El tiempo límite del
servidor debe superar el presupuesto del proveedor de visión.
"""

import json
from pathlib import Path

from utils.vision_client import (
    VISION_CONNECT_TIMEOUT_SECONDS,
    VISION_TIMEOUT_SECONDS,
)

DOCKERFILE = Path(__file__).resolve().parents[2] / "Dockerfile"
SERVER_MARGIN_SECONDS = 30


def _read_cmd_args():
    for line in DOCKERFILE.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if stripped.startswith("CMD"):
            return json.loads(stripped[len("CMD"):].strip())
    raise AssertionError("El Dockerfile no tiene una instruccion CMD")


# SDD: 024 REQ-009 AC-009.1
def test_gunicorn_timeout_exceeds_the_vision_provider_budget():
    args = _read_cmd_args()

    assert args[0] == "gunicorn"
    assert args.count("--timeout") == 1, "Debe haber un unico --timeout"

    value = args[args.index("--timeout") + 1]
    assert value.isdigit(), "--timeout debe ir seguido de un entero"

    minimum = (
        VISION_CONNECT_TIMEOUT_SECONDS
        + VISION_TIMEOUT_SECONDS
        + SERVER_MARGIN_SECONDS
    )
    assert int(value) >= minimum
