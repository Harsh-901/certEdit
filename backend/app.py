"""
Certificate Generation System — Flask Backend
Serves both API and frontend static files.
"""

import os
from flask import Flask, send_from_directory
from flask_cors import CORS
from routes.pdf_routes import pdf_bp
from routes.data_routes import data_bp

FRONTEND_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend")


def create_app():
    app = Flask(__name__, static_folder=None)
    CORS(app, expose_headers=["X-Session-ID"])

    # Ensure directories exist
    os.makedirs(os.path.join(os.path.dirname(__file__), "uploads"), exist_ok=True)
    os.makedirs(os.path.join(os.path.dirname(__file__), "output"), exist_ok=True)
    os.makedirs(os.path.join(os.path.dirname(__file__), "fonts"), exist_ok=True)

    # Register API blueprints
    app.register_blueprint(pdf_bp)
    app.register_blueprint(data_bp)

    @app.route("/api/health", methods=["GET"])
    def health():
        return {"status": "ok", "message": "CertEdit API is running."}

    # Serve frontend static files
    @app.route("/")
    def serve_index():
        return send_from_directory(FRONTEND_DIR, "index.html")

    @app.route("/<path:path>")
    def serve_static(path):
        # Try to serve the file from frontend directory
        full_path = os.path.join(FRONTEND_DIR, path)
        if os.path.isfile(full_path):
            directory = os.path.dirname(full_path)
            filename = os.path.basename(full_path)
            return send_from_directory(directory, filename)
        # Fallback to index.html for SPA routing
        return send_from_directory(FRONTEND_DIR, "index.html")

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(debug=True, port=5000)
