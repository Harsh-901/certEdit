"""
In-memory session store for certificate generation pipeline state.
Each session tracks: template, detected fields, data, mappings, font config.
"""

import uuid
import time

_sessions = {}

SESSION_TTL = 3600  # 1 hour


def create_session():
    """Create a new session and return its ID."""
    session_id = str(uuid.uuid4())
    _sessions[session_id] = {
        "created_at": time.time(),
        "template_path": None,
        "template_page_count": 0,
        "detected_fields": [],
        "fonts_config": {},       # {original_font: replacement_font_or_None}
        "data_file_path": None,
        "data_headers": [],
        "data_rows": [],
        "data_row_count": 0,
        "data_skipped_rows": 0,
        "mappings": {},           # {data_column: field_index}
        "name_column": None,
    }
    _cleanup_expired()
    return session_id


def get_session(session_id):
    """Retrieve a session by ID. Returns None if not found or expired."""
    session = _sessions.get(session_id)
    if session is None:
        return None
    if time.time() - session["created_at"] > SESSION_TTL:
        del _sessions[session_id]
        return None
    return session


def update_session(session_id, **kwargs):
    """Update session fields."""
    session = get_session(session_id)
    if session is None:
        return False
    for key, value in kwargs.items():
        if key in session:
            session[key] = value
    return True


def _cleanup_expired():
    """Remove expired sessions."""
    now = time.time()
    expired = [sid for sid, s in _sessions.items() if now - s["created_at"] > SESSION_TTL]
    for sid in expired:
        del _sessions[sid]
