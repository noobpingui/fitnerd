# El archivo config.py sirve para separar la configuración del entorno de la lógica de tu código. 
# Su función principal es centralizar todas las variables que definen cómo se comporta tu aplicación 
# (como accesos a bases de datos, claves de seguridad o modos de depuración) en un solo lugar.

import os
from dotenv import load_dotenv

load_dotenv() #To load the variables from the .env file


DEFAULT_LANGFUSE_BASE_URL = "https://us.cloud.langfuse.com"

DEFAULT_PORTION_ESTIMATE_MODEL = "claude-haiku-4-5"
PORTION_ESTIMATE_TIMEOUT_SECONDS = 15.0
PORTION_ESTIMATE_MAX_RETRIES = 1


def resolve_langfuse_base_url(value):
    """URL base de Langfuse: la configurada sin la barra final, o la de EE. UU. por defecto."""
    if not value:
        return DEFAULT_LANGFUSE_BASE_URL
    return value.rstrip("/")


DEFAULT_FRONTEND_BASE_URL = "http://localhost:5173"
FRONTEND_BASE_URL_REQUIRED_MESSAGE = (
    "FRONTEND_BASE_URL es obligatoria en producción y debe empezar por https://"
)


def resolve_frontend_base_url(value, *, required):
    """URL base del frontend: en producción es obligatoria y debe empezar por https://."""
    if not required:
        return DEFAULT_FRONTEND_BASE_URL if value is None else value
    cleaned = (value or "").strip()
    if not cleaned.startswith("https://"):
        raise ValueError(FRONTEND_BASE_URL_REQUIRED_MESSAGE)
    return cleaned


DEFAULT_SECRET_KEY = "DEFAULT SECRET"
KNOWN_DEFAULT_SECRET_KEYS = frozenset({"DEFAULT SECRET", "change-me"})
SECRET_KEY_REQUIRED_MESSAGE = (
    "SECRET_KEY es obligatoria en producción y no puede ser un valor por defecto"
)


def resolve_secret_key(value: str | None, *, required: bool) -> str:
    """Clave de firma: en producción es obligatoria y no puede ser un valor por defecto conocido."""
    if not required:
        return DEFAULT_SECRET_KEY if value is None else value
    if not isinstance(value, str) or value.strip() in KNOWN_DEFAULT_SECRET_KEYS | {""}:
        raise ValueError(SECRET_KEY_REQUIRED_MESSAGE)
    return value


def observability_enabled(config):
    """La observabilidad solo se activa con ambas claves y fuera de los tests."""
    return bool(
        config.get("LANGFUSE_PUBLIC_KEY")
        and config.get("LANGFUSE_SECRET_KEY")
        and not config.get("TESTING")
    )


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", DEFAULT_SECRET_KEY)
    SECRET_KEY_REQUIRED = False
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

    #URL de conexion a Redis - usado hoy para el rate limiting de /api/coach/ask.
    REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

    #Correo saliente (recuperación de contraseña): "console" (solo log, desarrollo),
    #"resend" (producción) o "memory" (tests).
    MAIL_BACKEND = os.getenv("MAIL_BACKEND", "console")
    RESEND_API_KEY = os.getenv("RESEND_API_KEY")
    MAIL_FROM = os.getenv("MAIL_FROM", "fitnerd <no-reply@fitnerd.betofallas.dev>")

    #URL base del frontend, usada para construir el enlace del correo.
    FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL")
    FRONTEND_BASE_URL_REQUIRED = False

    #Número de proxies de confianza delante de la app (ProxyFix, x_for).
    #0 = no se confía en X-Forwarded-For.
    PROXY_FIX_X_FOR = int(os.getenv("PROXY_FIX_X_FOR", "0"))

    #Observabilidad del coach (Langfuse Cloud, ADR-0017): sin las dos claves no se envía nada.
    LANGFUSE_PUBLIC_KEY = os.getenv("LANGFUSE_PUBLIC_KEY") or None
    LANGFUSE_SECRET_KEY = os.getenv("LANGFUSE_SECRET_KEY") or None
    LANGFUSE_BASE_URL = resolve_langfuse_base_url(os.getenv("LANGFUSE_BASE_URL"))
    OBSERVABILITY_ENVIRONMENT = "development"

    #Análisis de la foto de una comida (spec 024, ADR-0032): sin modelo, el proveedor
    #queda sin configurar.
    #Las credenciales de AWS no son variables de la app: boto3 usa su cadena por defecto.
    BEDROCK_VISION_MODEL_ID = os.getenv("BEDROCK_VISION_MODEL_ID") or None
    BEDROCK_REGION = os.getenv("BEDROCK_REGION", "us-east-1")

    #Estimación de porciones del diario (spec 030, ADR-0037): modelo propio y opcional.
    PORTION_ESTIMATE_MODEL = os.getenv("PORTION_ESTIMATE_MODEL") or None

class DevelopmentConfig(Config):
    """Configuración exclusiva para mi pc (Desarrollo)"""
    DEBUG = True
    SQLALCHEMY_DATABASE_URI = os.getenv("DEV_DATABASE_URL")

class ProductionConfig(Config):
    """Configuración exclusiva para el servidor real (Producción)"""
    DEBUG = False
    SQLALCHEMY_DATABASE_URI = os.getenv("PROD_DATABASE_URL")
    MAIL_BACKEND = os.getenv("MAIL_BACKEND", "resend")
    FRONTEND_BASE_URL_REQUIRED = True
    SECRET_KEY_REQUIRED = True
    #Un proxy de confianza: Caddy.
    PROXY_FIX_X_FOR = int(os.getenv("PROXY_FIX_X_FOR", "1"))
    OBSERVABILITY_ENVIRONMENT = "production"

class TestingConfig(Config):
    """Configuración exclusiva para correr los tests (pytest) - apunta a
    fitnerd_test, NUNCA a la base de desarrollo (los tests crean/borran
    tablas y datos libremente en cada corrida)."""
    TESTING = True
    DEBUG = False
    SQLALCHEMY_DATABASE_URI = os.getenv("TEST_DATABASE_URL")
    #Valores fijos: no deben depender del .env local.
    MAIL_BACKEND = "memory"
    FRONTEND_BASE_URL = "http://localhost:5173"
    PROXY_FIX_X_FOR = 1
    LANGFUSE_PUBLIC_KEY = None
    LANGFUSE_SECRET_KEY = None
    BEDROCK_VISION_MODEL_ID = None
    PORTION_ESTIMATE_MODEL = None
    OBSERVABILITY_ENVIRONMENT = "testing"


#Dictionary to easily select environments
config_by_name = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}