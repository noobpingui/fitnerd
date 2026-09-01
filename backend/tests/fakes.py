"""Fakes reutilizables entre distintos archivos de test unitario. Cada
repositorio real tiene una forma distinta (metodos distintos), asi que esos
se siguen definiendo a mano en cada archivo de test - pero UnitOfWork
siempre tiene la misma forma (commit/rollback) sin importar que servicio la
use, asi que vale la pena tenerla una sola vez aca en vez de repetirla.
"""


class FakeUnitOfWork:
    def __init__(self):
        self.committed = False
        self.rolled_back = False

    def commit(self):
        self.committed = True

    def rollback(self):
        self.rolled_back = True
