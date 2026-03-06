"""
PDF-related API routes: template upload, preview, bulk generation, download.
"""

import os
import base64
from flask import Blueprint, request, jsonify, send_file
from services import session_store, pdf_service, font_service

pdf_bp = Blueprint("pdf", __name__)

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "output")
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)


@pdf_bp.route("/api/upload-template", methods=["POST"])
def upload_template():
    """Upload a PDF template and extract text fields."""
    if "file" not in request.files:
        return jsonify({"stage": "pdf_upload", "status": "error",
                        "message": "No file provided. Please select a PDF file."}), 400

    file = request.files["file"]
    if not file.filename.lower().endswith(".pdf"):
        return jsonify({"stage": "pdf_upload", "status": "error",
                        "message": "Please upload a PDF file."}), 400

    # Create or reuse session
    session_id = request.headers.get("X-Session-ID")
    if not session_id or not session_store.get_session(session_id):
        session_id = session_store.create_session()

    # Save file
    filename = f"{session_id}_template.pdf"
    filepath = os.path.join(UPLOAD_DIR, filename)
    file.save(filepath)

    # Extract text fields
    result = pdf_service.extract_text_fields(filepath)

    if "error" in result:
        return jsonify({
            "stage": "pdf_upload",
            "status": "error",
            "message": result["error"],
            "session_id": session_id,
        }), 400

    # Store in session
    fields_clean = []
    for f in result["fields"]:
        field_copy = {k: v for k, v in f.items() if not k.startswith("_")}
        fields_clean.append(field_copy)

    session_store.update_session(session_id,
        template_path=filepath,
        template_page_count=result.get("page_count", 1),
        detected_fields=fields_clean,
    )

    # Detect fonts
    detected_fonts = set()
    for f in result["fields"]:
        detected_fonts.add(f["font"])

    font_results = []
    fonts_config = {}
    all_available = True

    for font_name in detected_fonts:
        check = font_service.check_font_availability(font_name)
        if check["available"]:
            matched = check["matched_name"]
            font_path = font_service.get_font_path(matched)
            fonts_config[font_name] = {"replacement": matched, "path": font_path}
            font_results.append({
                "detected": font_name,
                "available": True,
                "matched_to": matched,
                "is_alias": check["is_alias"],
                "suggestions": None,
            })
        else:
            all_available = False
            suggestions = font_service.suggest_similar_fonts(font_name)
            font_results.append({
                "detected": font_name,
                "available": False,
                "matched_to": None,
                "is_alias": False,
                "suggestions": suggestions,
            })

    session_store.update_session(session_id, fonts_config=fonts_config)

    return jsonify({
        "stage": "pdf_upload",
        "status": "success",
        "message": f"Found {len(fields_clean)} text fields across {result.get('page_count', 1)} page(s).",
        "session_id": session_id,
        "fields": fields_clean,
        "page_count": result.get("page_count", 1),
        "page_width": result.get("page_width", 0),
        "page_height": result.get("page_height", 0),
        "fonts": {
            "status": "ok" if all_available else "partial",
            "message": "All fonts loaded. Ready to map your data." if all_available
                       else f"{sum(1 for f in font_results if not f['available'])} font(s) not found. Please select replacements.",
            "results": font_results,
        },
    })


@pdf_bp.route("/api/select-font", methods=["POST"])
def select_font():
    """Select a replacement font for a missing font."""
    session_id = request.headers.get("X-Session-ID")
    session = session_store.get_session(session_id)
    if not session:
        return jsonify({"status": "error", "message": "Session not found. Please re-upload your template."}), 400

    data = request.get_json()
    original_font = data.get("original_font")
    replacement_font = data.get("replacement_font")

    if not original_font or not replacement_font:
        return jsonify({"status": "error", "message": "Please specify both the original and replacement font."}), 400

    # Download the replacement font
    font_path = font_service.get_font_path(replacement_font)

    fonts_config = session["fonts_config"]
    fonts_config[original_font] = {"replacement": replacement_font, "path": font_path}
    session_store.update_session(session_id, fonts_config=fonts_config)

    return jsonify({
        "stage": "font_selection",
        "status": "success",
        "message": f"'{replacement_font}' selected as replacement for '{original_font}'.",
        "font": original_font,
        "replacement": replacement_font,
    })


@pdf_bp.route("/api/preview", methods=["POST"])
def preview_certificate():
    """Generate a preview certificate using the first data row."""
    session_id = request.headers.get("X-Session-ID")
    session = session_store.get_session(session_id)
    if not session:
        return jsonify({"status": "error", "message": "Session not found."}), 400

    data = request.get_json() or {}
    mappings = data.get("mappings", session.get("mappings", {}))

    if not mappings:
        return jsonify({"status": "error", "message": "No field mappings defined. Please map at least one column."}), 400

    rows = session.get("data_rows", [])
    if not rows:
        return jsonify({"status": "error", "message": "No data loaded. Please upload a data file first."}), 400

    # Store mappings
    session_store.update_session(session_id, mappings=mappings)

    # Generate preview with first row
    pdf_bytes = pdf_service.generate_certificate(
        session["template_path"],
        mappings,
        rows[0],
        session.get("fonts_config", {}),
    )

    if pdf_bytes is None:
        return jsonify({"status": "error", "message": "Failed to generate preview."}), 500

    # Also get the original template as base64 for comparison
    with open(session["template_path"], "rb") as f:
        template_b64 = base64.b64encode(f.read()).decode("utf-8")

    preview_b64 = base64.b64encode(pdf_bytes).decode("utf-8")

    return jsonify({
        "stage": "preview",
        "status": "success",
        "message": "Preview ready.",
        "preview_pdf": preview_b64,
        "template_pdf": template_b64,
        "preview_data": rows[0],
    })


@pdf_bp.route("/api/generate", methods=["POST"])
def generate_certificates():
    """Bulk generate all certificates."""
    session_id = request.headers.get("X-Session-ID")
    session = session_store.get_session(session_id)
    if not session:
        return jsonify({"status": "error", "message": "Session not found."}), 400

    data = request.get_json() or {}
    mappings = data.get("mappings", session.get("mappings", {}))
    name_column = data.get("name_column", session.get("name_column"))

    if not mappings:
        return jsonify({"status": "error", "message": "No field mappings defined."}), 400

    rows = session.get("data_rows", [])
    if not rows:
        return jsonify({"status": "error", "message": "No data loaded."}), 400

    # Session-specific output dir
    output_dir = os.path.join(OUTPUT_DIR, session_id)

    result = pdf_service.generate_bulk(
        session["template_path"],
        mappings,
        rows,
        session.get("fonts_config", {}),
        name_column=name_column,
        output_dir=output_dir,
    )

    return jsonify({
        "stage": "generation",
        "status": "success",
        "message": f"Generated {result['count']} of {result['total']} certificates.",
        "count": result["count"],
        "total": result["total"],
        "warnings": result["warnings"],
        "download_zip": f"/api/download/{session_id}/zip",
        "download_merged": f"/api/download/{session_id}/merged",
    })


@pdf_bp.route("/api/download/<session_id>/<format_type>", methods=["GET"])
def download_certificates(session_id, format_type):
    """Download generated certificates."""
    output_dir = os.path.join(OUTPUT_DIR, session_id)

    if format_type == "zip":
        zip_path = os.path.join(output_dir, "certificates.zip")
        if os.path.exists(zip_path):
            return send_file(zip_path, as_attachment=True, download_name="certificates.zip")
    elif format_type == "merged":
        merged_path = os.path.join(output_dir, "certificates_merged.pdf")
        if os.path.exists(merged_path):
            return send_file(merged_path, as_attachment=True, download_name="certificates_merged.pdf")

    return jsonify({"status": "error", "message": "File not found."}), 404
