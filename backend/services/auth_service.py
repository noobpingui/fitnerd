import bcrypt

from models.user import User
from repositories.user_repository import UserRepository
from unit_of_work.unit_of_work import UnitOfWork
from utils.jwt_utils import JWTManager
from exceptions.custom_exceptions import ConflictError, AuthenticationError, ResourceNotFoundError



class AuthService():
    def __init__(self, user_repository: UserRepository, unit_of_work, jwt_manager: JWTManager):
        self.user_repository = user_repository
        self.jwt_manager = jwt_manager
        self.unit_of_work = unit_of_work

    #To create/register a new user
    def register(self, email, password, first_name, last_name, date_of_birth):

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

        user = self.user_repository.get_by_email(email)
        if not user:
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

    #To ckeck user authentication
    def get_me(self, user_id):

        user = self.user_repository.get_by_id(user_id)

        if user is None:
            raise ResourceNotFoundError("User not found")

        return user