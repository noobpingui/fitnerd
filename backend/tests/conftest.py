"""conftest.py es un nombre especial que pytest reconoce automaticamente -
cualquier fixture definida aca queda disponible para TODOS los tests de
esta carpeta (y subcarpetas) sin necesidad de importarla a mano en cada
archivo de test. Es el lugar central para "preparar el terreno" antes de
que corra cada test: la app de Flask, la base de datos de prueba, un
cliente HTTP falso, etc.
"""

import pytest

from app import create_app
from extensions import db as _db, jwt_manager as _jwt_manager


@pytest.fixture(scope="session")
def app():
    """Una sola instancia de la app para TODA la corrida de tests (scope
    "session", no "function") - crear la app registra blueprints,
    extensiones, etc., y no hay ninguna razon para pagar ese costo en cada
    uno de los tests. "testing" le dice a create_app() que use
    TestingConfig (config.py), que apunta a TEST_DATABASE_URL en vez de la
    base de desarrollo real.

    create_all()/drop_all() usan los modelos ya importados (ver
    models/__init__.py, que app.py importa) para crear/borrar TODAS las
    tablas de una - reemplaza correr las migraciones de Alembic una por
    una, que no hace falta en tests (no nos interesa probar el HISTORIAL
    de cambios de esquema, solo que el esquema actual funcione).

    IMPORTANTE: el "with app.app_context()" para create_all()/drop_all()
    se abre y se CIERRA de una, en vez de quedar abierto (con un solo
    "with" envolviendo el yield) durante toda la corrida de tests. Si se
    deja abierto, cualquier request hecho con `client` (test_routes/)
    termina reutilizando ese mismo app context en vez de abrir uno propio
    - y Flask solo dispara la limpieza automatica de la sesion de
    SQLAlchemy (session.remove(), via teardown_appcontext) cuando el
    context que se cierra es el que la propia request abrio. El resultado,
    si el bug esta presente: cada request deja su conexion a Postgres
    "idle in transaction" en vez de cerrarla, y esas conexiones se van
    acumulando hasta trabar (con locks) al resto de los tests. Encontrado
    y corregido en la primera corrida real de esta suite.
    """
    app = create_app("testing")

    with app.app_context():
        _db.create_all()

    yield app

    with app.app_context():
        _db.drop_all()


@pytest.fixture
def client(app):
    """Cliente HTTP de prueba: simula requests reales (client.post(...),
    client.get(...)) contra la app SIN levantar un servidor de verdad ni
    usar la red - todo corre en el mismo proceso de Python, lo que lo hace
    rapido. Es lo que se usa en los tests de integracion (carpeta
    test_routes/), para probar el flujo completo route -> service ->
    repository -> DB tal como lo golpearia el frontend real.
    """
    return app.test_client()


@pytest.fixture
def db_session(app):
    """Para tests UNITARIOS que necesitan hablar con la base de datos real
    directamente (sin pasar por un request HTTP) - Flask-SQLAlchemy exige
    un "app context" activo para poder usar db.session, asi que esta
    fixture lo abre y lo deja disponible durante el test. Los tests que
    solo usan `client` no la necesitan: el test_client ya abre su propio
    app context por cada request automaticamente.
    """
    with app.app_context():
        yield _db.session


@pytest.fixture(autouse=True)
def _clean_database(app):
    """autouse=True: esta fixture se aplica a TODOS los tests automatica-
    mente, sin que cada archivo tenga que pedirla por nombre.

    yield primero, limpieza despues: el test corre con la base como haya
    quedado (vacia, si el test anterior tambien uso esta fixture), y
    recien DESPUES de que el test termina, se vacian todas las tablas -
    dejando la base limpia para el test que sigue. Nunca se recrean las
    tablas en si (eso lo hizo `app` una sola vez arriba) - solo se borran
    las filas, que es mucho mas rapido.

    El orden de borrado importa: sorted_tables ya viene ordenado respetando
    las foreign keys (una tabla que otra referencia se crea/borra primero),
    y reversed() lo invierte para borrar - si borraramos "users" antes que
    "body_metrics", la foreign key de body_metrics.user_id todavia
    apuntando a una fila de users que ya no existe rompe la base.
    """
    yield
    with app.app_context():
        _db.session.rollback()
        for table in reversed(_db.metadata.sorted_tables):
            _db.session.execute(table.delete())
        _db.session.commit()


@pytest.fixture
def registered_user(client):
    """Fixture de conveniencia: registra un usuario real a traves del
    endpoint publico (el mismo camino que usaria el frontend, no un atajo
    directo a la base) y devuelve su token + un header de Authorization ya
    armado, listo para pasarle a cualquier otro request que necesite estar
    autenticado. Cualquier test de integracion que necesite "un usuario que
    ya existe" puede simplemente pedir esta fixture en vez de repetir el
    registro a mano.
    """
    response = client.post(
        "/api/auth/register",
        json={
            "email": "test@example.com",
            "password": "testpassword123",
            "first_name": "Test",
            "last_name": "User",
            "date_of_birth": "2000-01-01",
        },
    )
    token = response.get_json()["token"]
    return {"token": token, "headers": {"Authorization": f"Bearer {token}"}}


@pytest.fixture
def admin_headers(app):
    """A diferencia de `registered_user`, esta NO pasa por /api/auth/register
    (no hay forma self-service de volverse admin - ver
    project_fitnerd_backend.md) ni crea un usuario real en la base. Alcanza
    con firmar un token cuyo claim "user_role" sea "admin": el decorador
    require_admin (decorators/auth_decorators.py) solo mira ese claim, no
    verifica contra la base que exista un usuario admin real con ese id -
    asi que para testear la LOGICA DE AUTORIZACION esto es suficiente y
    evita depender de la base para algo que no hace falta.
    """
    with app.app_context():
        token = _jwt_manager.generate_token({"id": "admin-test-id", "user_role": "admin"}, 30)
    return {"Authorization": f"Bearer {token}"}
