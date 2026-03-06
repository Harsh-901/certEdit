"""
PDF-related API routes: template upload, font selection, preview, bulk generation, download.
Includes SSE stream for real-time progress during bulk generation.
"""

import os
import base64
import json
import threading
import queue
from flask import Blueprint, request, jsonify, send_file, Response, stream_with_context
from services import session_store, pdf_service, font_service

pdf_bp = Blueprint("pdf", __name__)

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "output")
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)


# ─── Upload PDF Template ────────────────────────────────────────────

@pdf_bp.route("/api/upload-pdf", methods=["POST"])
def upload_pdf():
    """Upload a PDF template and extract text fields."""
    if "file" not in request.files:
        return jsonify({"status": "error",
                        "message": "No file provided. Please select a PDF file."}), 400

    file = request.files["file"]
    if not file.filename.lower().endswith(".pdf"):
        return jsonify({"status": "error",
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
            "status": "error",
            "message": result["error"],
            "session_id": session_id,
        }), 400

    fields = result["fields"]

    # Store in session (field_metadata keyed by field id)
    field_metadata = {f["id"]: f for f in fields}
    session_store.update_session(session_id,
        template_path=filepath,
        template_page_count=result.get("page_count", 1),
        detected_fields=fields,
        field_metadata=field_metadata,
    )

    # ── Font detection ──
    detected_fonts = set(f["font"] for f in fields)
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
        "status": "success",
        "message": f"Found {len(fields)} text fields.",
        "session_id": session_id,
        "fields": fields,
        "page_width": result.get("page_width", 0),
        "page_height": result.get("page_height", 0),
        "font_status": {
            "all_available": all_available,
            "results": font_results,
        },
    })


# ─── Serve Template PDF to Frontend ──────────────────────────────────

@pdf_bp.route("/api/template-pdf/<session_id>", methods=["GET"])
def serve_template_pdf(session_id):
    """Serve the uploaded template PDF so PDF.js can render it."""
    session = session_store.get_session(session_id)
    if not session or not session.get("template_path"):
        return jsonify({"status": "error", "message": "No template found."}), 404

    return send_file(session["template_path"], mimetype="application/pdf")


# ─── Font Selection ──────────────────────────────────────────────────

@pdf_bp.route("/api/select-font", methods=["POST"])
def select_font():
    """Select a replacement font for a missing font."""
    session_id = request.headers.get("X-Session-ID")
    session = session_store.get_session(session_id)
    if not session:
        return jsonify({"status": "error",
                        "message": "Session not found. Please re-upload your template."}), 400

    data = request.get_json()
    original_font = data.get("original_font")
    replacement_font = data.get("replacement_font")

    if not original_font or not replacement_font:
        return jsonify({"status": "error",
                        "message": "Please specify both the original and replacement font."}), 400

    font_path = font_service.get_font_path(replacement_font)

    fonts_config = session["fonts_config"]
    fonts_config[original_font] = {"replacement": replacement_font, "path": font_path}
    session_store.update_session(session_id, fonts_config=fonts_config)

    return jsonify({
        "status": "success",
        "message": f"'{replacement_font}' selected for '{original_font}'.",
        "font": original_font,
        "replacement": replacement_font,
    })


# ─── Preview Certificate ─────────────────────────────────────────────

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
        return jsonify({"status": "error",
                        "message": "No field mappings defined. Map at least one column."}), 400

    rows = session.get("data_rows", [])
    if not rows:
        return jsonify({"status": "error",
                        "message": "No data loaded. Upload a data file first."}), 400

    # Store mappings
    session_store.update_session(session_id, mappings=mappings)

    # Build field_data from first row
    field_data = {}
    for field_id, column_name in mappings.items():
        field_data[field_id] = str(rows[0].get(column_name, "")).strip()

    field_metadata = session.get("field_metadata", {})

    pdf_bytes = pdf_service.generate_certificate(
        session["template_path"],
        field_data,
        field_metadata,
        session.get("fonts_config", {}),
    )

    if pdf_bytes is None or pdf_bytes is False:
        return jsonify({"status": "error", "message": "Failed to generate preview."}), 500

    preview_b64 = base64.b64encode(pdf_bytes).decode("utf-8")

    return jsonify({
        "status": "success",
        "message": "Preview generated.",
        "pdf_base64": preview_b64,
        "preview_row": rows[0],
    })


# ─── Bulk Generate (Synchronous) ─────────────────────────────────────

@pdf_bp.route("/api/generate", methods=["POST"])
def generate_certificates():
    """Bulk generate all certificates (synchronous, for small batches)."""
    session_id = request.headers.get("X-Session-ID")
    session = session_store.get_session(session_id)
    if not session:
        return jsonify({"status": "error", "message": "Session not found."}), 400

    data = request.get_json() or {}
    mappings = data.get("mappings", session.get("mappings", {}))
    name_column = data.get("name_column", session.get("name_column"))
    export_type = data.get("export_type", "both")

    if not mappings:
        return jsonify({"status": "error", "message": "No field mappings defined."}), 400

    rows = session.get("data_rows", [])
    if not rows:
        return jsonify({"status": "error", "message": "No data loaded."}), 400

    output_dir = os.path.join(OUTPUT_DIR, session_id)
    field_metadata = session.get("field_metadata", {})

    result = pdf_service.generate_bulk(
        session["template_path"],
        mappings,
        rows,
        field_metadata,
        session.get("fonts_config", {}),
        name_column=name_column,
        output_dir=output_dir,
    )

    return jsonify({
        "status": "success",
        "message": f"{result['count']} certificates ready to download.",
        "count": result["count"],
        "total": result["total"],
        "warnings": result["warnings"],
        "failures": result.get("failures", []),
        "download_zip": f"/api/download/{session_id}/zip",
        "download_merged": f"/api/download/{session_id}/merged",
    })


# ─── Bulk Generate with SSE Progress ─────────────────────────────────

@pdf_bp.route("/api/generate-stream", methods=["POST"])
def generate_certificates_stream():
    """Bulk generate all certificates with SSE progress updates."""
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

    output_dir = os.path.join(OUTPUT_DIR, session_id)
    field_metadata = session.get("field_metadata", {})
    fonts_config = session.get("fonts_config", {})
    template_path = session["template_path"]

    # Use a queue for thread-safe SSE communication
    progress_queue = queue.Queue()

    def progress_callback(current, total, current_name):
        progress_queue.put({
            "type": "progress",
            "progress": current,
            "total": total,
            "current_name": current_name,
        })

    def run_generation():
        try:
            result = pdf_service.generate_bulk(
                template_path, mappings, rows, field_metadata, fonts_config,
                name_column=name_column, output_dir=output_dir,
                progress_callback=progress_callback,
            )
            progress_queue.put({
                "type": "complete",
                "count": result["count"],
                "total": result["total"],
                "warnings": result["warnings"],
                "failures": result.get("failures", []),
                "download_zip": f"/api/download/{session_id}/zip",
                "download_merged": f"/api/download/{session_id}/merged",
            })
        except Exception as e:
            progress_queue.put({"type": "error", "message": str(e)})

    thread = threading.Thread(target=run_generation, daemon=True)
    thread.start()

    def event_stream():
        while True:
            try:
                msg = progress_queue.get(timeout=120)
                yield f"data: {json.dumps(msg)}\n\n"
                if msg.get("type") in ("complete", "error"):
                    break
            except queue.Empty:
                # Send keepalive
                yield f"data: {json.dumps({'type': 'keepalive'})}\n\n"

    return Response(
        stream_with_context(event_stream()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# ─── Download Generated Files ────────────────────────────────────────

@pdf_bp.route("/api/download/<session_id>/<format_type>", methods=["GET"])
def download_certificates(session_id, format_type):
    """Download generated certificates as ZIP or merged PDF."""
    output_dir = os.path.join(OUTPUT_DIR, session_id)

    if format_type == "zip":
        zip_path = os.path.join(output_dir, "certificates.zip")
        if os.path.exists(zip_path):
            return send_file(zip_path, as_attachment=True,
                             download_name="certificates.zip")
    elif format_type == "merged":
        merged_path = os.path.join(output_dir, "certificates_merged.pdf")
        if os.path.exists(merged_path):
            return send_file(merged_path, as_attachment=True,
                             download_name="certificates_merged.pdf")

    return jsonify({"status": "error", "message": "File not found."}), 404
