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


class FakeLLMClient:
    """Doble de LLMClient (Anthropic) - devuelve `answer` como si Claude
    hubiera respondido bien, o levanta `raise_error` para simular una
    falla real del proveedor. `calls` queda para poder afirmar CUANTAS
    veces (o si) se llego a llamar - clave para probar que un
    short-circuit (rate limit, sin contexto, etc.) evita gastar una
    llamada real."""
    def __init__(self, answer="Respuesta de mentira, sin tocar Anthropic", raise_error=None):
        self.answer = answer
        self.raise_error = raise_error
        self.calls = []

    def generate(self, system_prompt, messages):
        self.calls.append((system_prompt, messages))
        if self.raise_error:
            raise self.raise_error
        return self.answer


class FakeRateLimiter:
    """Doble de RateLimiter (Redis) - `allowed` decide si
    check_and_increment devuelve True o False, sin tocar Redis para nada.
    `calls` guarda los argumentos de cada llamada, para poder verificar
    CON QUE key se esta limitando (ej: que incluya el user_id correcto)."""
    def __init__(self, allowed=True):
        self.allowed = allowed
        self.calls = []

    def check_and_increment(self, key, limit, window_seconds):
        self.calls.append((key, limit, window_seconds))
        return self.allowed
