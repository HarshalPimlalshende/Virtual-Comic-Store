import os
import logging
from flask import Flask
from flask_login import LoginManager
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm import DeclarativeBase

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

# Import routes (after app and db initialization to avoid circular imports)
from routes import *

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))
