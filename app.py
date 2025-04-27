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
from flask_admin import AdminIndexView, expose
from flask import render_template

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

    class MyAdminIndexView(AdminIndexView):
        @expose('/')
        def index(self):
            from models import User, Comic, Review  # Import models here
            user_count = User.query.count()
            comic_count = Comic.query.count()
            review_count = Review.query.count()

            # Optionally, you can prepare data points for charts here
            return self.render('admin_dashboard.html',
                            user_count=user_count,
                            comic_count=comic_count,
                            review_count=review_count)

    @expose('/')
    def index(self):
        from models import User, Comic, Review  # Adjust path as needed
        from sqlalchemy import func
        import datetime

        # Basic counts
        user_count = User.query.count()
        comic_count = Comic.query.count()
        review_count = Review.query.count()

        # Genre Distribution (Pie Chart)
        genre_data = db.session.query(Comic.genre, func.count(Comic.id)).group_by(Comic.genre).all()
        genre_labels = [genre for genre, count in genre_data]
        genre_counts = [count for genre, count in genre_data]

        # Signup trend (Line Chart - users by month)
        signup_data = (
            db.session.query(func.strftime('%Y-%m', User.created_at), func.count(User.id))
            .group_by(func.strftime('%Y-%m', User.created_at))
            .order_by(func.strftime('%Y-%m', User.created_at))
            .all()
        )
        signup_dates = [date for date, count in signup_data]
        signup_counts = [count for date, count in signup_data]

        return self.render(
            'admin_dashboard.html',
            user_count=user_count,
            comic_count=comic_count,
            review_count=review_count,
            genre_labels=genre_labels,
            genre_counts=genre_counts,
            signup_dates=signup_dates,
            signup_counts=signup_counts
        )



# Setup Flask-Admin
admin = Admin(app,
              name="Virtual Comic Studio - Admin Panel",
              template_mode="bootstrap3",
              index_view=MyAdminIndexView())


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
