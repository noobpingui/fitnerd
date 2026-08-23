from routes.auth_routes import auth_bp
from routes.coach_routes import coach_bp
from routes.body_metric_routes import body_metric_bp
from routes.exercise_category_routes import exercise_category_bp
from routes.exercise_routes import exercise_bp
from routes.exercise_favorite_routes import exercise_favorite_bp


def register_blueprints(app):
    app.register_blueprint(auth_bp)
    app.register_blueprint(coach_bp)
    app.register_blueprint(body_metric_bp)
    app.register_blueprint(exercise_category_bp)
    app.register_blueprint(exercise_bp)
    app.register_blueprint(exercise_favorite_bp)
