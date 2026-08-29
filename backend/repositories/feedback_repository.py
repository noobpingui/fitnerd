from repositories.base_repository import BaseRepository
from models import Feedback


class FeedbackRepository(BaseRepository):

    def __init__(self, session):
        super().__init__(session, Feedback)

    #Sin metodos extra por ahora: create() (heredado de BaseRepository) es lo unico que
    #usa la app hoy. list_all() (tambien heredado) ya alcanza para revisar el feedback
    #recibido a mano (ej. por consola de Flask/psql) hasta que exista una pantalla de
    #administracion que lo justifique.
