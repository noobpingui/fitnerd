
import voyageai


class EmbeddingClient:
    def __init__(self):
        #Bare instance, sin API key todavia - mismo patron que JWTManager en jwt_utils.py
        self.client = None
        self.model = None

    def init_app(self, app):
        self.client = voyageai.Client(api_key=app.config["VOYAGE_API_KEY"])
        self.model = app.config["VOYAGE_EMBEDDING_MODEL"]

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        #Para indexar contenido (los chunks de las transcripciones)
        result = self.client.embed(texts, model=self.model, input_type="document")
        return result.embeddings

    def embed_query(self, text: str) -> list[float]:
        #Para la pregunta del usuario en tiempo de busqueda (lo vamos a usar en el retrieval service)
        result = self.client.embed([text], model=self.model, input_type="query")
        return result.embeddings[0]
