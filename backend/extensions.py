#El archivo extensions.py sirve para centralizar la creación de las librerías (extensiones) de Flask y 
#evitar el problema de importación circular. 
#(cuando dos archivos intentan importarse entre sí al mismo tiempo, lo que rompe la aplicación)

from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_cors import CORS
from utils.jwt_utils import JWTManager
from utils.embeddings import EmbeddingClient
from utils.rate_limiter import RateLimiter
from utils.email_sender import EmailSender
from utils.tracing import Tracer
from utils.vision_client import BedrockVisionClient
from utils.llm_client import LazyLLMClient
from config import (
    DEFAULT_ANTHROPIC_MODEL,
    DEFAULT_PORTION_ESTIMATE_MODEL,
    PORTION_ESTIMATE_MAX_RETRIES,
    PORTION_ESTIMATE_TIMEOUT_SECONDS,
)

db = SQLAlchemy()
migrate = Migrate()
cors = CORS()
jwt_manager = JWTManager()
embedding_client = EmbeddingClient()
rate_limiter = RateLimiter()
email_sender = EmailSender()
tracer = Tracer()
vision_client = BedrockVisionClient()
coach_llm = LazyLLMClient("ANTHROPIC_MODEL", DEFAULT_ANTHROPIC_MODEL)
portion_llm =LazyLLMClient(
    "PORTION_ESTIMATE_MODEL",
    DEFAULT_PORTION_ESTIMATE_MODEL,
    timeout=PORTION_ESTIMATE_TIMEOUT_SECONDS,
    max_retries=PORTION_ESTIMATE_MAX_RETRIES,
)
