from sqlalchemy import text


class HealthRepository:

    def __init__(self, session):
        self.session = session

    def ping(self) -> None:
        #Consulta trivial de solo lectura, sin add/flush/commit (NFR-002).
        self.session.execute(text("SELECT 1"))
