from sqlalchemy import select, func

from repositories.base_repository import BaseRepository
from models import ProgressAnalysis


class ProgressAnalysisRepository(BaseRepository):

    def __init__(self, session):
        super().__init__(session, ProgressAnalysis)

    #Cuenta cuantos analisis corrio este usuario en la ventana deslizante de las ultimas
    #`window` horas (no un contador de "dia calendario" que resetea a medianoche).
    #El cutoff se calcula con func.now() - window, DENTRO de la query - a proposito, en vez
    #de calcular "hace 24hs" en Python y mandarlo como parametro: created_at (como todos los
    #timestamps de este proyecto) se guarda sin timezone, y compararlo contra un datetime
    #con timezone armado en Python es una fuente clasica de bugs sutiles (offsets que no
    #calzan segun el timezone del server). Dejando que Postgres reste el intervalo contra
    #su propio now(), la comparacion queda consistente con como se genero created_at en
    #primer lugar (el mismo now() del server_default).
    def count_since(self, user_id, window) -> int:
        cutoff = func.now() - window
        stmt = select(func.count()).select_from(self.model).where(
            self.model.user_id == user_id,
            self.model.created_at >= cutoff,
        )
        return self.session.scalar(stmt)
