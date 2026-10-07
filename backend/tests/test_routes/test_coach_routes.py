"""Integracion de POST /api/coach/ask: solo lo que cambia con la
observabilidad (las preguntas invalidas no generan traza). El resto de AC se
prueba a nivel de servicio, porque la ruta construye clientes reales de
Anthropic y Voyage.
"""

import pytest

from extensions import tracer
from tests.fakes_observability import FakeTraceBackend


# SDD: REQ-001 AC-001.3
@pytest.mark.parametrize(
    "question",
    ["", "   ", "x" * 501],
    ids=["empty", "only-spaces", "501-characters"],
)
def test_invalid_questions_return_400_and_send_no_trace(client, registered_user, question):
    """Una pregunta vacia, de solo espacios o de mas de 500 caracteres
    responde 400 y el destino no recibe ninguna traza."""
    backend = FakeTraceBackend()
    tracer.backend = backend

    response = client.post(
        "/api/coach/ask",
        json={"question": question},
        headers=registered_user["headers"],
    )

    assert response.status_code == 400
    assert backend.traces == []
