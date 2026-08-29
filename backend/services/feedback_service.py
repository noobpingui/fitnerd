from repositories.feedback_repository import FeedbackRepository
from unit_of_work.unit_of_work import UnitOfWork
from models.feedback import Feedback
from exceptions.custom_exceptions import ValidationError

#Fijas en el backend (no en una tabla aparte) a proposito: son pocas, no cambian seguido,
#y validarlas aca evita que un request manual (fuera del form del frontend) mande
#cualquier string como categoria.
ALLOWED_CATEGORIES = {"general", "suggestion", "bug"}
MAX_MESSAGE_LENGTH = 2000


class FeedbackService:
    def __init__(self, feedback_repository: FeedbackRepository, unit_of_work: UnitOfWork):
        self.feedback_repository = feedback_repository
        self.unit_of_work = unit_of_work

    def create_feedback(self, user_id, category, message):
        if category not in ALLOWED_CATEGORIES:
            raise ValidationError("Categoria invalida")

        if not message or not message.strip():
            raise ValidationError("El mensaje no puede estar vacio")

        message = message.strip()
        if len(message) > MAX_MESSAGE_LENGTH:
            raise ValidationError(f"El mensaje no puede superar los {MAX_MESSAGE_LENGTH} caracteres")

        feedback = Feedback(
            user_id=user_id,
            category=category,
            message=message,
        )

        self.feedback_repository.create(feedback)
        self.unit_of_work.commit()

        return feedback
