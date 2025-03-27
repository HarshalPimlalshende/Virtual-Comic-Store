from app import app
from serverless_wsgi import handle_request
from flask import Flask
app = Flask(__name__)

@app.route('/')
def home():
    return "Hello from Flask on Vercel!"

# Vercel requires this exact format
def handler(request):
    return app(request)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
