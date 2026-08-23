#El archivo extensions.py sirve para centralizar la creación de las librerías (extensiones) de Flask y 
#evitar el problema de importación circular. 
#(cuando dos archivos intentan importarse entre sí al mismo tiempo, lo que rompe la aplicación)

from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_cors import CORS
from utils.jwt_utils import JWTManager
from utils.embeddings import EmbeddingClient

db = SQLAlchemy()
migrate = Migrate()
cors = CORS()
jwt_manager = JWTManager()
embedding_client = EmbeddingClient()

