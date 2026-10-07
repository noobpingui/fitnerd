"""EmbeddingClient (utils/embeddings.py) con un cliente de Voyage de mentira
asignado a `client` - sin red ni mocks.
"""

from tests.fakes_observability import FakeVoyageClient
from utils.embeddings import EmbeddingClient


def make_client(fake):
    client = EmbeddingClient()
    client.client = fake
    client.model = "voyage-test-model"
    return client


# SDD: REQ-002 AC-002.3
def test_embed_query_with_usage_returns_the_vector_and_the_tokens():
    """Devuelve el vector de la consulta y los tokens que informa Voyage."""
    fake = FakeVoyageClient(embeddings=[[0.1, 0.2, 0.3]], total_tokens=12)
    client = make_client(fake)

    vector, tokens = client.embed_query_with_usage("¿Y el descanso?")

    assert vector == [0.1, 0.2, 0.3]
    assert tokens == 12
    assert fake.calls[0] == {"texts": ["¿Y el descanso?"], "model": "voyage-test-model", "input_type": "query"}


# SDD: REQ-002 AC-002.3
def test_embed_query_with_usage_returns_none_tokens_when_voyage_does_not_report_them():
    """Si la respuesta no trae `total_tokens`, los tokens son `None`."""
    client = make_client(FakeVoyageClient(total_tokens=None))

    vector, tokens = client.embed_query_with_usage("pregunta")

    assert vector == [0.1, 0.2, 0.3]
    assert tokens is None


# SDD: REQ-002 AC-002.3
def test_embed_query_is_unchanged_and_returns_only_the_vector():
    """`embed_query` sigue devolviendo solo el vector."""
    client = make_client(FakeVoyageClient(embeddings=[[0.5, 0.6]]))

    assert client.embed_query("pregunta") == [0.5, 0.6]
