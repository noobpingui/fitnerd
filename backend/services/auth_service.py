import bcrypt
from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests

from models.user import User
from repositories.user_repository import UserRepository
from unit_of_work.unit_of_work import UnitOfWork
from utils.jwt_utils import JWTManager
from exceptions.custom_exceptions import ConflictError, AuthenticationError, ResourceNotFoundError
from services.credential_rules import (
    exceeds_bcrypt_limit,
    normalize_email,
    validate_email,
    validate_new_password,
)
from services.profile_service import utc_now

WRONG_CREDENTIALS_MESSAGE = "Correo o contraseña incorrectos"
EMAIL_TAKEN_MESSAGE = "Ya existe una cuenta con este correo"



def verify_google_id_token(id_token_str: str, client_id: str | None) -> dict:
    # Valida la firma con las llaves públicas de Google, la caducidad y el "audience".
    # Lanza ValueError si el token no es válido.
    return google_id_token.verify_oauth2_token(id_token_str, google_requests.Request(), client_id)


class AuthService():
    def __init__(self, user_repository: UserRepository, unit_of_work, jwt_manager: JWTManager, google_client_id: str = None,
                 google_token_verifier=verify_google_id_token, clock=utc_now):
        self.clock = clock
        self.google_token_verifier = google_token_verifier
        self.user_repository = user_repository
        self.jwt_manager = jwt_manager
        self.unit_of_work = unit_of_work
        self.google_client_id = google_client_id

    def register_from_body(self, _body: object) -> str:
        """Comprueba que `body` es un objeto JSON y delega en `register` con sus campos."""
        raise NotImplementedError("not implemented")

    def login_from_body(self, _body: object) -> str:
        """Comprueba que `body` es un objeto JSON y delega en `login` con `email` y `password`."""
        raise NotImplementedError("not implemented")

    #To create/register a new user
    def register(self, email, password, first_name, last_name, date_of_birth):
        # Primero el correo y después la contraseña; ambos antes de consultar duplicados.
        email = validate_email(email)
        validate_new_password(password)

        try:
            #Validation to avoid duplicated users
            existing_user = self.user_repository.get_by_email(email)
            if existing_user:
                raise ConflictError("Email already registered")

            #Hashing the password before passing it to the repository to save it to the DB.
            hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())

            #bcrypt returns bytes, not a string. PostgreSQL with SQLAlchemy expects a string for the
            #password column, so it's neccesary to decode it back after hashing it.

            password_hash = hashed.decode('utf-8')

            user = User(email=email, 
                        password_hash=password_hash,
                        first_name=first_name, 
                        last_name=last_name, 
                        date_of_birth=date_of_birth)

            new_user = self.user_repository.create(user)
            self.unit_of_work.commit()

            #The payload for the token with JWT 
            payload = {
                "id": str(new_user.id),
                "user_role": new_user.user_role.value
            }

            token = self.jwt_manager.generate_token(payload, 30)

            return token

        except Exception:
            self.unit_of_work.rollback()
            raise

    #To login
    def login(self, email: str, password: str):

        # Datos anómalos: mismo error que unas credenciales incorrectas, sin consultar la base.
        # No se exige el mínimo de 8: cuentas antiguas pueden tener contraseñas más cortas.
        if (
            not isinstance(email, str)
            or not isinstance(password, str)
            or exceeds_bcrypt_limit(password)
        ):
            raise AuthenticationError("Wrong Credentials")

        user = self.user_repository.get_by_email(normalize_email(email))
        if not user:
            raise AuthenticationError("Wrong Credentials")

        #Una cuenta creada via Google no tiene password_hash (ver models/user.py) -
        #si alguien intenta entrar con password contra esa cuenta, la tratamos
        #igual que credenciales incorrectas (mismo mensaje/status que cualquier
        #otro login fallido, no revelamos que "esta cuenta es solo-Google").
        if not user.password_hash:
            raise AuthenticationError("Wrong Credentials")

        if not bcrypt.checkpw(password.encode('utf-8'), user.password_hash.encode('utf-8')):
            raise AuthenticationError("Wrong Credentials")

        #The payload for the token with JWT
        payload = {
            "id": str(user.id),
            "user_role": user.user_role.value
        }

        token = self.jwt_manager.generate_token(payload, 30)

        return token

    #Login/registro via Google Identity Services. id_token_str es el credential
    #que el frontend recibe de Google (un JWT firmado por Google, no el nuestro).
    def login_with_google(self, id_token_str):

        try:
            #verify_oauth2_token valida la firma criptografica del token (con las
            #llaves publicas de Google), que no este vencido, y que el "audience"
            #(para que app fue emitido) coincida con nuestro GOOGLE_CLIENT_ID -
            #eso ultimo evita que un token emitido para OTRA app pueda usarse aca.
            claims = self.google_token_verifier(id_token_str, self.google_client_id)
        except ValueError:
            raise AuthenticationError("Invalid Google token")

        #email_verified confirma que Google ya verifico que el usuario es dueno
        #real de ese email (no solo que lo escribio) - sin esto, en teoria
        #alguien podria intentar entrar con un email ajeno sin haberlo probado.
        if not claims.get("email_verified"):
            raise AuthenticationError("Google email not verified")

        email = normalize_email(claims["email"])
        google_id = claims["sub"]  #Identificador estable de ESA cuenta de Google

        user = self.user_repository.get_by_email(email)

        try:
            if user is None:
                #Primera vez que se ve este email: cuenta nueva, sin password.
                user = User(
                    email=email,
                    password_hash=None,
                    first_name=claims.get("given_name"),
                    last_name=claims.get("family_name"),
                    date_of_birth=None,
                    google_id=google_id,
                    avatar_url=claims.get("picture"),
                )
                user = self.user_repository.create(user)
                self.unit_of_work.commit()
            elif user.google_id is None:
                #Ya existia una cuenta con este email (registrada con
                #password) y todavia no estaba vinculada a Google - la
                #vinculamos automaticamente. Es seguro porque Google ya
                #verifico que el usuario es dueno del email (chequeo de
                #arriba), asi que no hay riesgo de que alguien mas
                #"secuestre" la cuenta con un email que no le pertenece.
                user.google_id = google_id
                if not user.avatar_url:
                    user.avatar_url = claims.get("picture")
                self.unit_of_work.commit()
            #Si user.google_id ya estaba seteado, no hay nada que actualizar -
            #es simplemente un login de una cuenta ya vinculada.
        except Exception:
            self.unit_of_work.rollback()
            raise

        payload = {
            "id": str(user.id),
            "user_role": user.user_role.value
        }

        token = self.jwt_manager.generate_token(payload, 30)

        return token

    #To ckeck user authentication
    def get_me(self, user_id):

        user = self.user_repository.get_by_id(user_id)

        if user is None:
            raise ResourceNotFoundError("User not found")

        return user