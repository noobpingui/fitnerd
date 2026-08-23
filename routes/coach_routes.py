import anthropic

from flask import Blueprint, request, jsonify, current_app

from extensions import db, embedding_client
from repositories.transcript_chunk_repository import TranscriptChunkRepository
from services.retrieval_service import RetrievalService
from services.coach_service import CoachService
from decorators import require_auth
from exceptions.custom_exceptions import ValidationError

coach_bp = Blueprint(
    "coach",
    __name__,
    url_prefix="/api/coach"
)

MAX_QUESTION_LENGTH = 500


#Factory function - mismo patron que _build_auth_service() en auth_routes.py
def _build_coach_service():
    transcript_chunk_repository = TranscriptChunkRepository(db.session)
    retrieval_service = RetrievalService(transcript_chunk_repository, embedding_client)

    #anthropic.Anthropic() sin argumentos lee ANTHROPIC_API_KEY directo de las variables
    #de entorno (ya cargadas por load_dotenv() en config.py) - no hace falta pasarla a mano.
    anthropic_client = anthropic.Anthropic()

    return CoachService(retrieval_service, anthropic_client, current_app.config["ANTHROPIC_MODEL"])


@coach_bp.route("/ask", methods=["POST"])
@require_auth
def ask():
    data = request.get_json()
    question = data.get("question")

    if not question or not question.strip():
        raise ValidationError("La pregunta no puede estar vacia")

    if len(question) > MAX_QUESTION_LENGTH:
        raise ValidationError(f"La pregunta no puede superar los {MAX_QUESTION_LENGTH} caracteres")

    coach_service = _build_coach_service()
    answer = coach_service.ask(question)

    return jsonify(answer=answer), 200
