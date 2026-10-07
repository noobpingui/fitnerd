from repositories.transcript_chunk_repository import TranscriptChunkRepository
from utils.embeddings import EmbeddingClient

DEFAULT_TOP_K = 5


class RetrievalService:
    def __init__(self, transcript_chunk_repository: TranscriptChunkRepository, embedding_client: EmbeddingClient, max_distance: float = 0.7):
        self.transcript_chunk_repository = transcript_chunk_repository
        self.embedding_client = embedding_client

        #Umbral de distancia coseno: por encima de esto, consideramos que el chunk NO es relevante.
        #0.7 es un punto de partida razonable, no un numero "correcto" - hay que calibrarlo
        #probando preguntas reales contra el corpus real y mirando que distancias salen.
        self.max_distance = max_distance

    @property
    def embedding_model(self) -> str | None:
        return self.embedding_client.model

    def embed(self, text: str) -> tuple[list[float], int | None]:
        return self.embedding_client.embed_query_with_usage(text)

    #Todos los candidatos del repositorio, sin filtrar por umbral y en su mismo orden.
    def find_candidates(self, vector: list[float], top_k: int = DEFAULT_TOP_K) -> list[dict]:
        results = self.transcript_chunk_repository.find_similar(vector, limit=top_k)
        return [
            {"video_title": video_title, "chunk_text": chunk.chunk_text, "distance": distance}
            for chunk, video_title, distance in results
        ]

    def is_relevant(self, candidate: dict) -> bool:
        return candidate["distance"] <= self.max_distance

    def search(self, question: str, top_k: int = DEFAULT_TOP_K):
        vector, _ = self.embed(question)
        candidates = self.find_candidates(vector, top_k)
        return [c for c in candidates if self.is_relevant(c)]
