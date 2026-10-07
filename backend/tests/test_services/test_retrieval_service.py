"""RetrievalService con un repositorio y un cliente de embeddings de mentira,
inyectados por constructor - sin Postgres, Voyage ni red.
"""

from services.retrieval_service import RetrievalService
from tests.fakes_observability import FakeEmbeddingClient, FakeTranscriptChunkRepository

ROWS = [
    ("Texto A", "Video A", 0.35),
    ("Texto B", "Video B", 0.62),
    ("Texto C", "Video C", 0.71),
    ("Texto D", "Video D", 0.9),
    ("Texto E", "Video E", 1.1),
    ("Texto F", "Video F", 1.3),
    ("Texto G", "Video G", 1.5),
]


def make_service(rows=None):
    repository = FakeTranscriptChunkRepository(ROWS if rows is None else rows)
    embedding_client = FakeEmbeddingClient(vector=[0.1, 0.2], tokens=7, model="voyage-test-model")
    return RetrievalService(repository, embedding_client), repository, embedding_client


# SDD: REQ-003 AC-003.1
def test_find_candidates_returns_every_result_with_its_distance_in_repository_order():
    """Devuelve todos los resultados sin filtrar por umbral y en el mismo
    orden, con titulo, texto y distancia."""
    service, repository, _ = make_service(rows=ROWS[:4])

    candidates = service.find_candidates([0.1, 0.2])

    assert candidates == [
        {"video_title": "Video A", "chunk_text": "Texto A", "distance": 0.35},
        {"video_title": "Video B", "chunk_text": "Texto B", "distance": 0.62},
        {"video_title": "Video C", "chunk_text": "Texto C", "distance": 0.71},
        {"video_title": "Video D", "chunk_text": "Texto D", "distance": 0.9},
    ]


# SDD: REQ-003 AC-003.1
def test_find_candidates_respects_the_default_limit_of_five():
    """Por defecto pide `DEFAULT_TOP_K` (5) resultados al repositorio."""
    from services.retrieval_service import DEFAULT_TOP_K

    service, repository, _ = make_service()

    candidates = service.find_candidates([0.1, 0.2])

    assert DEFAULT_TOP_K == 5
    assert repository.calls[0]["limit"] == 5
    assert len(candidates) == 5


# SDD: REQ-003 AC-003.2
def test_find_candidates_keeps_candidates_that_exceed_the_threshold():
    """Los candidatos por encima del umbral tambien se devuelven."""
    service, _, _ = make_service(rows=[("Texto A", "Video A", 0.75), ("Texto B", "Video B", 0.9)])

    assert [c["distance"] for c in service.find_candidates([0.1, 0.2])] == [0.75, 0.9]


# SDD: REQ-003 AC-003.3
def test_find_candidates_with_empty_corpus_returns_an_empty_list():
    """Un corpus vacio devuelve una lista vacia."""
    service, _, _ = make_service(rows=[])

    assert service.find_candidates([0.1, 0.2]) == []


# SDD: REQ-003 AC-003.3
def test_is_relevant_accepts_the_threshold_boundary_and_rejects_above_it():
    """En el limite de 0,7 la distancia 0,7 pasa y 0,71 no."""
    service, _, _ = make_service()

    assert service.is_relevant({"distance": 0.7}) is True
    assert service.is_relevant({"distance": 0.71}) is False
    assert service.is_relevant({"distance": 0.0}) is True


# SDD: REQ-006 AC-006.2
def test_is_relevant_uses_the_configured_max_distance():
    """El umbral es `max_distance`, configurable por constructor."""
    service = RetrievalService(FakeTranscriptChunkRepository([]), FakeEmbeddingClient(), max_distance=0.5)

    assert service.max_distance == 0.5
    assert service.is_relevant({"distance": 0.5}) is True
    assert service.is_relevant({"distance": 0.6}) is False


# SDD: REQ-002 AC-002.3
def test_embed_returns_the_vector_and_tokens_and_exposes_the_embedding_model():
    """`embed` delega en el cliente de embeddings y devuelve vector y tokens;
    `embedding_model` expone el modelo del cliente."""
    service, _, embedding_client = make_service()

    vector, tokens = service.embed("¿Y el descanso?")

    assert vector == [0.1, 0.2]
    assert tokens == 7
    assert embedding_client.queries == ["¿Y el descanso?"]
    assert service.embedding_model == "voyage-test-model"


# SDD: REQ-003 AC-003.1
def test_search_still_returns_only_relevant_chunks_in_the_same_shape_and_order():
    """`search()` compuesto devuelve lo mismo que antes: solo los fragmentos
    que pasan el umbral, con `chunk_text`, `video_title` y `distance`."""
    service, repository, embedding_client = make_service()

    result = service.search("¿Cuántas series hago?")

    assert result == [
        {"chunk_text": "Texto A", "video_title": "Video A", "distance": 0.35},
        {"chunk_text": "Texto B", "video_title": "Video B", "distance": 0.62},
    ]
    assert embedding_client.queries == ["¿Cuántas series hago?"]
    assert repository.calls[0]["limit"] == 5


# SDD: REQ-003 AC-003.1
def test_search_honors_a_custom_top_k():
    """`search(question, top_k)` sigue respetando el limite pedido."""
    service, repository, _ = make_service()

    result = service.search("pregunta", top_k=1)

    assert repository.calls[0]["limit"] == 1
    assert len(result) == 1


# SDD: REQ-003 AC-003.2
def test_search_returns_an_empty_list_when_nothing_is_relevant():
    """Sin fragmentos bajo el umbral devuelve una lista vacia."""
    service, _, _ = make_service(rows=[("Texto A", "Video A", 0.75), ("Texto B", "Video B", 0.9)])

    assert service.search("pregunta") == []
