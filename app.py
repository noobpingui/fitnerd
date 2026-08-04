import os
import models

from flask import Flask
from config import config_by_name
from extensions import db, migrate, jwt_manager
from exceptions import error_handlers
from routes import register_blueprints

def create_app(config_name=None):

    #To initialize the Flask application
    app = Flask(__name__)

    #To fallback to FLASK_ENV or 'default
    if not config_name:
        config_name = os.environ.get('FLASK_ENV', 'default')

    #To load all the variables from that class to app.config: "DEBUG"=TRUE, "SQLALCHEMY_DATABASE_URI"=..., etc
    app.config.from_object(config_by_name[config_name])

    #To initialize extensions here like db, auth, migrate, etc
    db.init_app(app)
    migrate.init_app(app,db)
    jwt_manager.init_app(app)
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