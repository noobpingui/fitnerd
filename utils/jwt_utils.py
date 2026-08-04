
import jwt
import datetime
from typing import Dict, Any
from exceptions.custom_exceptions import AuthenticationError

class JWTManager:
    def __init__(self):
        #Bare instance, no keys loaded yet - mirrors db = SQLAlchemy() in extensions.py.
        #init_app(app) does the real setup once app.config actually has the key paths.
        self.private_key = None
        self.public_key = None
        self.algorithm = "RS256"

    def init_app(self, app):
        private_key_path = app.config["JWT_PRIVATE_KEY_PATH"]
        public_key_path = app.config["JWT_PUBLIC_KEY_PATH"]

        #To load the RSA keys from the disk
        with open(private_key_path, "r") as file:
            self.private_key = file.read()

        with open(public_key_path, "r") as file:
            self.public_key = file.read()


    def generate_token(self, claims: Dict[str, Any], expires_in_minutes: int) -> str:

        

        #To create a new dict, add the expiration data below and keep the original dict untouched/clean
        payload = claims.copy()

        #Standard security
        now = datetime.datetime.now(datetime.timezone.utc)
        
        payload.update({
            "iat": now,  #issued at
            "exp": now + datetime.timedelta(minutes=expires_in_minutes) #Expiration
        })

        #To encode with private key
        token = jwt.encode(payload, self.private_key, algorithm=self.algorithm)
        return token
    

    def decode_token(self, token:str):

        #To verify and decode a JWT Token using the public key
        try:
            payload = jwt.decode(token, self.public_key, algorithms=[self.algorithm])
            return payload
        
        except jwt.ExpiredSignatureError:
            raise AuthenticationError()
        
        except jwt.InvalidTokenError:
            raise AuthenticationError()