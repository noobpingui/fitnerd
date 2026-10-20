from routes.auth_routes import auth_bp
from routes.coach_routes import coach_bp
from routes.body_metric_routes import body_metric_bp
from routes.feedback_routes import feedback_bp
from routes.food_routes import food_bp
from routes.health_routes import health_bp
from routes.profile_routes import profile_bp


def register_blueprints(app):
    app.register_blueprint(auth_bp)
    app.register_blueprint(coach_bp)
    app.register_blueprint(body_metric_bp)
    app.register_blueprint(feedback_bp)
    app.register_blueprint(food_bp)
    app.register_blueprint(health_bp)
    app.register_blueprint(profile_bp)
