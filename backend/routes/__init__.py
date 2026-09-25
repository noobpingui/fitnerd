from routes.auth_routes import auth_bp
from routes.coach_routes import coach_bp
from routes.body_metric_routes import body_metric_bp
from routes.body_region_routes import body_region_bp
from routes.exercise_category_routes import exercise_category_bp
from routes.exercise_routes import exercise_bp
from routes.exercise_favorite_routes import exercise_favorite_bp
from routes.feedback_routes import feedback_bp
from routes.health_routes import health_bp
from routes.weekly_plan_routes import weekly_plan_bp


def register_blueprints(app):
    app.register_blueprint(auth_bp)
    app.register_blueprint(coach_bp)
    app.register_blueprint(body_metric_bp)
    app.register_blueprint(body_region_bp)
    app.register_blueprint(exercise_category_bp)
    app.register_blueprint(exercise_bp)
    app.register_blueprint(exercise_favorite_bp)
    app.register_blueprint(feedback_bp)
    app.register_blueprint(health_bp)
    app.register_blueprint(weekly_plan_bp)
