/**
 * API wrapper for CertEdit backend.
 * Manages session ID and provides typed methods for each endpoint.
 */

let sessionId = null;

function getHeaders(isJson = false) {
    const headers = {};
    if (sessionId) headers['X-Session-ID'] = sessionId;
    if (isJson) headers['Content-Type'] = 'application/json';
    return headers;
}

export function getSessionId() {
    return sessionId;
}

export async function uploadTemplate(file) {
    const formData = new FormData();
    formData.append('file', file);

    const resp = await fetch('/api/upload-template', {
        method: 'POST',
        headers: { ...(sessionId ? { 'X-Session-ID': sessionId } : {}) },
        body: formData,
    });

    const data = await resp.json();

    if (data.session_id) {
        sessionId = data.session_id;
    }

    return data;
}

export async function selectFont(originalFont, replacementFont) {
    const resp = await fetch('/api/select-font', {
        method: 'POST',
        headers: getHeaders(true),
        body: JSON.stringify({ original_font: originalFont, replacement_font: replacementFont }),
    });
    return resp.json();
}

export async function uploadData(file) {
    const formData = new FormData();
    formData.append('file', file);

    const resp = await fetch('/api/upload-data', {
        method: 'POST',
        headers: { ...(sessionId ? { 'X-Session-ID': sessionId } : {}) },
        body: formData,
    });

    return resp.json();
}

export async function validateMapping(mappings, nameColumn) {
    const resp = await fetch('/api/validate-mapping', {
        method: 'POST',
        headers: getHeaders(true),
        body: JSON.stringify({ mappings, name_column: nameColumn }),
    });
    return resp.json();
}

export async function generatePreview(mappings) {
    const resp = await fetch('/api/preview', {
        method: 'POST',
        headers: getHeaders(true),
        body: JSON.stringify({ mappings }),
    });
    return resp.json();
}

export async function generateCertificates(mappings, nameColumn) {
    const resp = await fetch('/api/generate', {
        method: 'POST',
        headers: getHeaders(true),
        body: JSON.stringify({ mappings, name_column: nameColumn }),
    });
    return resp.json();
}

export function getDownloadUrl(format) {
    return `/api/download/${sessionId}/${format}`;
}

export async function getFontLibrary() {
    const resp = await fetch('/api/font-library');
    return resp.json();
}
