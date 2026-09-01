from flask import Blueprint, request, jsonify, current_app, g

from extensions import db, embedding_client, rate_limiter
from repositories.transcript_chunk_repository import TranscriptChunkRepository
from services.retrieval_service import RetrievalService
from services.coach_service import CoachService
from utils.llm_client import LLMClient
from decorators import require_auth
from exceptions.custom_exceptions import ValidationError

coach_bp = Blueprint(
    "coach",
    __name__,
    url_prefix="/api/coach"
)

MAX_QUESTION_LENGTH = 500
#Tope de turnos de historial que se reenvian a Claude por pregunta - una conversacion mas
#larga que esto simplemente "olvida" los turnos mas viejos, en vez de dejar crecer el
#contexto (y el costo) sin limite.
MAX_HISTORY_MESSAGES = 20
ALLOWED_HISTORY_ROLES = {"user", "assistant"}


#El historial viaja desde el frontend en cada request (no se guarda en el backend, ver
#CoachService.ask) - se sanea antes de reenviarselo a Claude en vez de confiar en la forma
#exacta que mande el cliente. Entradas con forma invalida se descartan en silencio (no vale
#la pena rechazar toda la conversacion por un item malformado) en vez de tirar un error.
def _sanitize_history(history):
    if not isinstance(history, list):
        return []

    clean = []
    for item in history:
        if not isinstance(item, dict):
            continue

        role = item.get("role")
        content = item.get("content")

        if role in ALLOWED_HISTORY_ROLES and isinstance(content, str) and content.strip():
            clean.append({"role": role, "content": content})

    return clean[-MAX_HISTORY_MESSAGES:]


#Factory function - mismo patron que _build_auth_service() en auth_routes.py
def _build_coach_service():
    transcript_chunk_repository = TranscriptChunkRepository(db.session)
    retrieval_service = RetrievalService(transcript_chunk_repository, embedding_client)
    llm_client = LLMClient(model=current_app.config["ANTHROPIC_MODEL"])

    return CoachService(retrieval_service, llm_client, rate_limiter)


@coach_bp.route("/ask", methods=["POST"])
@require_auth
def ask():
    data = request.get_json()
    question = data.get("question")

    if not question or not question.strip():
        raise ValidationError("La pregunta no puede estar vacia")

    if len(question) > MAX_QUESTION_LENGTH:
        raise ValidationError(f"La pregunta no puede superar los {MAX_QUESTION_LENGTH} caracteres")

    history = _sanitize_history(data.get("history"))
    user_id = g.decoded_token["id"]

    coach_service = _build_coach_service()
    answer = coach_service.ask(question, user_id, history)

    return jsonify(answer=answer), 200
