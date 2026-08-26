# El archivo config.py sirve para separar la configuración del entorno de la lógica de tu código. 
# Su función principal es centralizar todas las variables que definen cómo se comporta tu aplicación 
# (como accesos a bases de datos, claves de seguridad o modos de depuración) en un solo lugar.

import os
from dotenv import load_dotenv

load_dotenv() #To load the variables from the .env file

class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "DEFAULT SECRET")
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    #Origenes permitidos para CORS, separados por coma (ej: "http://localhost:5173,https://fitnerd.app")
    #Default cubre el puerto que usa Vite en desarrollo.
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
    JWT_PRIVATE_KEY_PATH = os.getenv("JWT_PRIVATE_KEY_PATH")
    JWT_PUBLIC_KEY_PATH = os.getenv("JWT_PUBLIC_KEY_PATH")

    S3_BUCKET_NAME = os.getenv("S3_BUCKET_NAME")
    VOYAGE_API_KEY = os.getenv("VOYAGE_API_KEY")
    VOYAGE_EMBEDDING_MODEL = os.getenv("VOYAGE_EMBEDDING_MODEL")

    ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-5")

    #Client ID de la app registrada en Google Cloud Console (OAuth 2.0) -
    #se usa para verificar que un ID token de Google realmente fue emitido
    #para NUESTRA app (el "audience" del token) y no para otra.
    GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")

class DevelopmentConfig(Config):
    """Configuración exclusiva para mi pc (Desarrollo)"""
    DEBUG = True
    SQLALCHEMY_DATABASE_URI = os.getenv("DEV_DATABASE_URL")

class ProductionConfig(Config):
    """Configuración exclusiva para el servidor real (Producción)"""
    DEBUG = False
    SQLALCHEMY_DATABASE_URI = os.getenv("PROD_DATABASE_URL")


#Dictionary to easily select environments
config_by_name = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig 
}