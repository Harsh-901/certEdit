/**
 * CertEdit — API Client
 * Session-aware wrapper for all backend endpoints.
 */

let sessionId = null;

function headers(json = false) {
    const h = {};
    if (sessionId) h['X-Session-ID'] = sessionId;
    if (json) h['Content-Type'] = 'application/json';
    return h;
}

export function getSessionId() { return sessionId; }

export async function uploadPdf(file) {
    const fd = new FormData();
    fd.append('file', file);
    const r = await fetch('/api/upload-pdf', {
        method: 'POST',
        headers: sessionId ? { 'X-Session-ID': sessionId } : {},
        body: fd,
    });
    const data = await r.json();
    if (data.session_id) sessionId = data.session_id;
    return data;
}

export async function uploadData(file) {
    const fd = new FormData();
    fd.append('file', file);
    const r = await fetch('/api/upload-data', {
        method: 'POST',
        headers: sessionId ? { 'X-Session-ID': sessionId } : {},
        body: fd,
    });
    return r.json();
}

export async function selectFont(originalFont, replacementFont) {
    const r = await fetch('/api/select-font', {
        method: 'POST',
        headers: headers(true),
        body: JSON.stringify({ original_font: originalFont, replacement_font: replacementFont }),
    });
    return r.json();
}

export async function validateMapping(mappings, nameColumn) {
    const r = await fetch('/api/validate-mapping', {
        method: 'POST',
        headers: headers(true),
        body: JSON.stringify({ mappings, name_column: nameColumn }),
    });
    return r.json();
}

export async function generatePreview(mappings) {
    const r = await fetch('/api/preview', {
        method: 'POST',
        headers: headers(true),
        body: JSON.stringify({ mappings }),
    });
    return r.json();
}

export async function generateCertificates(mappings, nameColumn) {
    const r = await fetch('/api/generate', {
        method: 'POST',
        headers: headers(true),
        body: JSON.stringify({ mappings, name_column: nameColumn }),
    });
    return r.json();
}

export function generateCertificatesStream(mappings, nameColumn, onProgress, onComplete, onError) {
    // Use fetch + ReadableStream for SSE since EventSource doesn't support POST
    fetch('/api/generate-stream', {
        method: 'POST',
        headers: headers(true),
        body: JSON.stringify({ mappings, name_column: nameColumn }),
    }).then(async (response) => {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const msg = JSON.parse(line.slice(6));
                        if (msg.type === 'progress') onProgress(msg);
                        else if (msg.type === 'complete') onComplete(msg);
                        else if (msg.type === 'error') onError(msg.message);
                    } catch { /* skip malformed */ }
                }
            }
        }
    }).catch(err => onError(err.message));
}

export function getDownloadUrl(format) {
    return `/api/download/${sessionId}/${format}`;
}

export function getTemplatePdfUrl() {
    return `/api/template-pdf/${sessionId}`;
}

export async function getFontLibrary() {
    const r = await fetch('/api/font-library');
    return r.json();
}
