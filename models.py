import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import UserMixin
from app import db
import json


user_library = db.Table('user_library',
    db.Column('user_id', db.Integer, db.ForeignKey('user.id'), primary_key=True),
    db.Column('comic_id', db.Integer, db.ForeignKey('comic.id'), primary_key=True)
)

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    
    # Relationships
    comics_uploaded = db.relationship('Comic', backref='owner', lazy='dynamic')
    reviews = db.relationship('Review', backref='user', lazy='dynamic')
    library_comics = db.relationship('Comic', secondary=user_library, 
                                    lazy='dynamic', backref=db.backref('in_libraries', lazy='dynamic'))
    
    def __init__(self, username, email, password):
        self.username = username
        self.email = email
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
    
    def save(self):
        db.session.add(self)
        db.session.commit()
        return self
    
    def add_to_library(self, comic_id):
        comic = Comic.query.get(comic_id)
        if comic and comic not in self.library_comics:
            self.library_comics.append(comic)
            db.session.commit()
            return True
        return False
    
    def remove_from_library(self, comic_id):
        comic = Comic.query.get(comic_id)
        if comic and comic in self.library_comics:
            self.library_comics.remove(comic)
            db.session.commit()
            return True
        return False
    
    @property
    def library(self):
        return [comic.id for comic in self.library_comics]
    
    @classmethod
    def get_by_username(cls, username):
        return cls.query.filter_by(username=username).first()
    
    @classmethod
    def get_by_email(cls, email):
        return cls.query.filter_by(email=email).first()


class Comic(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, nullable=False)
    filename = db.Column(db.String(255), nullable=False, unique=True)
    owner_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    upload_date = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    views = db.Column(db.Integer, default=0)
    logo_id = db.Column(db.Integer, default=1) # Logo ID (1-5)
    
    # Relationships
    reviews = db.relationship('Review', backref='comic', lazy='dynamic', cascade='all, delete-orphan')
    
    def __init__(self, title, description, filename, owner_id, logo_id=None):
        self.title = title
        self.description = description
        self.filename = filename
        self.owner_id = owner_id
        self.logo_id = logo_id
    
    def save(self):
        db.session.add(self)
        db.session.commit()
        return self
    
    def get_average_rating(self):
        reviews = self.reviews.all()
        if not reviews:
            return 0
        return sum(review.rating for review in reviews) / len(reviews)
    
    def increment_views(self):
        self.views += 1
        db.session.commit()
        return self.views
    
    @property
    def ratings(self):
        return self.reviews.all()
    
    @classmethod
    def get_by_id(cls, comic_id):
        return cls.query.get(comic_id)
    
    @classmethod
    def get_all(cls):
        return cls.query.all()
    
    @classmethod
    def get_by_owner(cls, owner_id):
        return cls.query.filter_by(owner_id=owner_id).all()


class Review(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    comic_id = db.Column(db.Integer, db.ForeignKey('comic.id'), nullable=False)
    text = db.Column(db.Text, nullable=False)
    rating = db.Column(db.Integer, nullable=False)  # 1-5 rating
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    
    def __init__(self, user_id, comic_id, text, rating):
        self.user_id = user_id
        self.comic_id = comic_id
        self.text = text
        self.rating = rating
    
    def save(self):
        db.session.add(self)
        db.session.commit()
        return self
    
    @classmethod
    def get_by_comic(cls, comic_id):
        return cls.query.filter_by(comic_id=comic_id).order_by(cls.created_at.desc()).all()
    
    @classmethod
    def get_by_user(cls, user_id):
        return cls.query.filter_by(user_id=user_id).order_by(cls.created_at.desc()).all()
