from flask import jsonify
from werkzeug.exceptions import HTTPException

from exceptions.base_exceptions import AppError

#custom_exceptions defines what can go wrong and error_handlers defines what Flask does about it

def register_error_handlers(app):

    @app.errorhandler(AppError)
    def handle_app_error(error):
        return jsonify({"error": error.message}), error.status_code

    @app.errorhandler(HTTPException)
    def handle_http_exception(error):
        return jsonify({"error": error.description}), error.code

    @app.errorhandler(Exception)
    def handle_unexpected_error(error):
        app.logger.exception(error)
        return jsonify({"error": "Internal server error"}), 500
