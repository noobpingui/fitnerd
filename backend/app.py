import os
import models

from flask import Flask
from werkzeug.middleware.proxy_fix import ProxyFix
from config import config_by_name, resolve_frontend_base_url, resolve_secret_key
from utils.clock import install_clock
from extensions import (
    db, migrate, cors, jwt_manager, embedding_client, rate_limiter, email_sender, tracer,
    vision_client, portion_llm,
)
from utils.in_memory_request import InMemoryUploadRequest
from exceptions import error_handlers
from routes import register_blueprints

def create_app(config_name=None, config_overrides=None):

    #To initialize the Flask application
    app = Flask(__name__)

    #Los archivos subidos se guardan en memoria, nunca en un temporal en disco (spec 024)
    app.request_class = InMemoryUploadRequest

    #To fallback to FLASK_ENV or 'default
    if not config_name:
        config_name = os.environ.get('FLASK_ENV', 'default')

    #To load all the variables from that class to app.config: "DEBUG"=TRUE, "SQLALCHEMY_DATABASE_URI"=..., etc
    app.config.from_object(config_by_name[config_name])
    app.config.update(config_overrides or {})

    #En producción FRONTEND_BASE_URL es obligatoria (https://); si falta, falla al arrancar
    app.config["FRONTEND_BASE_URL"] = resolve_frontend_base_url(
        app.config.get("FRONTEND_BASE_URL"),
        required=app.config.get("FRONTEND_BASE_URL_REQUIRED", False),
    )

    #En producción SECRET_KEY es obligatoria y no puede ser un valor por defecto (spec 027)
    app.config["SECRET_KEY"] = resolve_secret_key(
        app.config.get("SECRET_KEY"),
        required=app.config.get("SECRET_KEY_REQUIRED", False),
    )

    #Reloj de la app: fijable solo con TESTING (ADR-0028)
    install_clock(app)

    #Detrás de Caddy, remote_addr sería la IP del proxy: se toma la de X-Forwarded-For (ADR-0015)
    if app.config["PROXY_FIX_X_FOR"] > 0:
        app.wsgi_app = ProxyFix(app.wsgi_app, x_for=app.config["PROXY_FIX_X_FOR"])

    #To initialize extensions here like db, auth, migrate, etc
    db.init_app(app)
    migrate.init_app(app,db)
    cors.init_app(app, resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}})
    jwt_manager.init_app(app)
    rate_limiter.init_app(app)
    embedding_client.init_app(app)
    email_sender.init_app(app)
    tracer.init_app(app)
    vision_client.init_app(app)
    portion_llm.init_app(app)
    error_handlers.register_error_handlers(app)
    register_blueprints(app)

    return app

if __name__ == '__main__':

    #To select the env or use 'development' as the default one
    env = os.environ.get('FLASK_ENV','development')

    #To create an instance of the app
    app = create_app(env)


    #To run the app and start the development server
    app.run()