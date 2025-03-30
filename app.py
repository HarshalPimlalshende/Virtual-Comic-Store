import os
import logging
from flask import Flask
from flask_admin import Admin
from flask_admin.contrib.sqla import ModelView
from flask_login import LoginManager
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm import DeclarativeBase
from flask_admin.contrib.sqla import ModelView
from flask_login import current_user

# Configure logging
logging.basicConfig(level=logging.DEBUG)

# Create base class for SQLAlchemy models
class Base(DeclarativeBase):
    pass

# Initialize SQLAlchemy
db = SQLAlchemy(model_class=Base)

# Initialize app
app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "default-secret-key-for-development")

# Configure the database
app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get("DATABASE_URL", "sqlite:///comic_app.db")
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
    "pool_recycle": 300,
    "pool_pre_ping": True,
}


# Initialize SQLAlchemy with the app
db.init_app(app)

# Initialize login manager
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'
login_manager.login_message_category = 'danger'

# Load models and then create tables
with app.app_context():
    from models import User, Comic, Review
    db.create_all()

# Setup Flask-Admin
admin = Admin(app, name="Virtual Comic Store - Admin Panel", template_mode="bootstrap3")

# Add views to the admin panel
admin.add_view(ModelView(User, db.session))
admin.add_view(ModelView(Comic, db.session))
admin.add_view(ModelView(Review, db.session))

# Import routes (after app and db initialization to avoid circular imports)
from routes import *

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

if __name__ == "__main__":
    app.run(debug=True)
