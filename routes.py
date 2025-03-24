import os
import uuid
import logging
from flask import render_template, request, redirect, url_for, flash, session, abort, send_from_directory
from werkzeug.utils import secure_filename
from flask_login import login_user, logout_user, current_user, login_required
from app import app
from models import User, Comic, Review

# Configure upload folder
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'pdf'}

# Create uploads directory if it doesn't exist
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max upload size

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/')
def index():
    recent_comics = sorted(Comic.get_all(), key=lambda x: x.upload_date, reverse=True)[:10]
    return render_template('index.html', comics=recent_comics)

@app.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('index'))
    
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        remember = 'remember' in request.form
        
        user = User.get_by_username(username)
        
        if user and user.check_password(password):
            login_user(user, remember=remember)
            next_page = request.args.get('next')
            flash('Login successful!', 'success')
            return redirect(next_page or url_for('index'))
        else:
            flash('Invalid username or password', 'danger')
    
    return render_template('login.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('index'))
    
    if request.method == 'POST':
        username = request.form.get('username')
        email = request.form.get('email')
        password = request.form.get('password')
        confirm_password = request.form.get('confirm_password')
        
        # Validate inputs
        if User.get_by_username(username):
            flash('Username already exists', 'danger')
            return render_template('register.html')
        
        if User.get_by_email(email):
            flash('Email already in use', 'danger')
            return render_template('register.html')
        
        if password != confirm_password:
            flash('Passwords don\'t match', 'danger')
            return render_template('register.html')
        
        user = User(username=username, email=email, password=password)
        user.save()
        
        flash('Account created successfully! You can now log in.', 'success')
        return redirect(url_for('login'))
    
    return render_template('register.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    flash('You have been logged out', 'info')
    return redirect(url_for('index'))

@app.route('/profile')
@login_required
def profile():
    user_comics = Comic.get_by_owner(current_user.id)
    return render_template('profile.html', user=current_user, comics=user_comics)

@app.route('/upload', methods=['GET', 'POST'])
@login_required
def upload_comic():
    if request.method == 'POST':
        if 'comic_file' not in request.files:
            flash('No file part', 'danger')
            return redirect(request.url)
        
        file = request.files['comic_file']
        
        if file.filename == '':
            flash('No selected file', 'danger')
            return redirect(request.url)
        
        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            # Add unique identifier to prevent filename collisions
            unique_filename = f"{uuid.uuid4()}_{filename}"
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
            
            try:
                file.save(file_path)
                
                title = request.form.get('title')
                description = request.form.get('description')
                
                comic = Comic(
                    title=title,
                    description=description,
                    filename=unique_filename,
                    owner_id=current_user.id
                )
                comic.save()
                
                flash('Comic uploaded successfully!', 'success')
                return redirect(url_for('comic_details', comic_id=comic.id))
            except Exception as e:
                logging.error(f"Error uploading file: {e}")
                flash('Error uploading file', 'danger')
                return redirect(request.url)
        else:
            flash('File type not allowed. Please upload a PDF file.', 'danger')
            return redirect(request.url)
    
    return render_template('upload.html')

@app.route('/library')
@login_required
def library():
    user_library = [Comic.get_by_id(comic_id) for comic_id in current_user.library]
    # Filter out any None values that might occur if a comic was deleted
    user_library = [comic for comic in user_library if comic]
    return render_template('library.html', comics=user_library)

@app.route('/comic/<comic_id>')
def comic_details(comic_id):
    comic = Comic.get_by_id(comic_id)
    if not comic:
        flash('Comic not found', 'danger')
        return redirect(url_for('index'))
    
    reviews = Review.get_by_comic(comic_id)
    owner = User.get_by_id(comic.owner_id)
    
    # Increment view count
    comic.increment_views()
    
    return render_template('comic_details.html', comic=comic, reviews=reviews, owner=owner)

@app.route('/comic/<comic_id>/read')
def read_comic(comic_id):
    comic = Comic.get_by_id(comic_id)
    if not comic:
        flash('Comic not found', 'danger')
        return redirect(url_for('index'))
    
    return render_template('comic_viewer.html', comic=comic)

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/comic/<comic_id>/add_to_library')
@login_required
def add_to_library(comic_id):
    comic = Comic.get_by_id(comic_id)
    if not comic:
        flash('Comic not found', 'danger')
        return redirect(url_for('index'))
    
    if current_user.add_to_library(comic_id):
        flash('Comic added to your library', 'success')
    else:
        flash('Comic is already in your library', 'info')
    
    return redirect(url_for('comic_details', comic_id=comic_id))

@app.route('/comic/<comic_id>/remove_from_library')
@login_required
def remove_from_library(comic_id):
    if current_user.remove_from_library(comic_id):
        flash('Comic removed from your library', 'success')
    else:
        flash('Comic was not in your library', 'info')
    
    return redirect(url_for('library'))

@app.route('/comic/<comic_id>/review', methods=['POST'])
@login_required
def add_review(comic_id):
    comic = Comic.get_by_id(comic_id)
    if not comic:
        flash('Comic not found', 'danger')
        return redirect(url_for('index'))
    
    text = request.form.get('review_text')
    rating = int(request.form.get('rating', 5))
    
    # Validate rating
    if rating < 1 or rating > 5:
        flash('Rating must be between 1 and 5', 'danger')
        return redirect(url_for('comic_details', comic_id=comic_id))
    
    review = Review(
        user_id=current_user.id,
        comic_id=comic_id,
        text=text,
        rating=rating
    )
    review.save()
    
    flash('Review added successfully', 'success')
    return redirect(url_for('comic_details', comic_id=comic_id))

@app.route('/search')
def search():
    query = request.args.get('q', '').lower()
    results = []
    
    if query:
        for comic in Comic.get_all():
            if query in comic.title.lower() or query in comic.description.lower():
                results.append(comic)
    
    return render_template('index.html', comics=results, search_query=query)
