"""
Data file upload and mapping validation routes.
"""

import os
from flask import Blueprint, request, jsonify
from services import session_store, data_service

data_bp = Blueprint("data", __name__)

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


@data_bp.route("/api/upload-data", methods=["POST"])
def upload_data():
    """Upload a data file (XLSX, CSV, or JSON) and parse it."""
    session_id = request.headers.get("X-Session-ID")
    session = session_store.get_session(session_id)
    if not session:
        return jsonify({"status": "error", "message": "Session not found. Please upload a template first."}), 400

    if "file" not in request.files:
        return jsonify({"status": "error", "message": "No file provided."}), 400

    file = request.files["file"]
    ext = os.path.splitext(file.filename)[1].lower()

    if ext not in [".xlsx", ".csv", ".json"]:
        return jsonify({"status": "error",
                        "message": "Unsupported file format. Please upload an XLSX, CSV, or JSON file."}), 400

    # Save file
    filename = f"{session_id}_data{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    file.save(filepath)

    # Parse file
    result = data_service.parse_data_file(filepath)

    if "error" in result:
        return jsonify({
            "stage": "data_upload",
            "status": "error",
            "message": result["error"],
        }), 400

    # Store in session
    session_store.update_session(session_id,
        data_file_path=filepath,
        data_headers=result["headers"],
        data_rows=result["rows"],
        data_row_count=result["row_count"],
        data_skipped_rows=result.get("skipped_rows", 0),
    )

    # Build skip message
    skip_msg = ""
    if result.get("skipped_rows", 0) > 0:
        skip_msg = f" ({result['skipped_rows']} empty row(s) skipped.)"

    return jsonify({
        "stage": "data_upload",
        "status": "success",
        "message": f"Loaded {result['row_count']} records from your data file.{skip_msg}",
        "headers": result["headers"],
        "row_count": result["row_count"],
        "skipped_rows": result.get("skipped_rows", 0),
        "preview": result["preview"],
    })


@data_bp.route("/api/validate-mapping", methods=["POST"])
def validate_mapping():
    """Validate the column-to-field mapping configuration."""
    session_id = request.headers.get("X-Session-ID")
    session = session_store.get_session(session_id)
    if not session:
        return jsonify({"status": "error", "message": "Session not found."}), 400

    data = request.get_json()
    mappings = data.get("mappings", {})
    name_column = data.get("name_column")

    if not mappings:
        return jsonify({
            "stage": "mapping_validation",
            "status": "error",
            "message": "At least one mapping must be defined.",
        }), 400

    warnings = []
    headers = session.get("data_headers", [])

    # Check for unmapped name-like columns
    name_hints = ["name", "full name", "fullname", "recipient", "student", "participant", "awardee"]
    mapped_columns = set(mappings.values())

    for header in headers:
        if header.lower().strip() in name_hints and header not in mapped_columns:
            warnings.append(f"It looks like you haven't mapped the '{header}' column. Are you sure?")

    # Store mappings and name column
    session_store.update_session(session_id, mappings=mappings, name_column=name_column)

    return jsonify({
        "stage": "mapping_validation",
        "status": "warning" if warnings else "success",
        "message": "Mappings validated." if not warnings else "Mappings saved with warnings.",
        "warnings": warnings,
        "mapping_count": len(mappings),
    })


@data_bp.route("/api/font-library", methods=["GET"])
def get_font_library():
    """Return the full font library for browsing."""
    from services import font_service
    return jsonify({
        "fonts": font_service.get_all_library_fonts(),
    })
