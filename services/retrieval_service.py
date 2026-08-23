from repositories.transcript_chunk_repository import TranscriptChunkRepository
from utils.embeddings import EmbeddingClient


class RetrievalService:
    def __init__(self, transcript_chunk_repository: TranscriptChunkRepository, embedding_client: EmbeddingClient, max_distance: float = 0.7):
        self.transcript_chunk_repository = transcript_chunk_repository
        self.embedding_client = embedding_client

        #Umbral de distancia coseno: por encima de esto, consideramos que el chunk NO es relevante.
        #0.7 es un punto de partida razonable, no un numero "correcto" - hay que calibrarlo
        #probando preguntas reales contra el corpus real y mirando que distancias salen.
        self.max_distance = max_distance

    def search(self, question: str, top_k: int = 5):
        query_embedding = self.embedding_client.embed_query(question)

        results = self.transcript_chunk_repository.find_similar(query_embedding, limit=top_k)

        relevant_chunks = []
        for chunk, video_title, distance in results:
            if distance > self.max_distance:
                continue

            relevant_chunks.append({
                "chunk_text": chunk.chunk_text,
                "video_title": video_title,
                "distance": distance,
            })

        return relevant_chunks
