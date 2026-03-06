/**
 * Step 1 — Upload PDF Template
 * Drag-and-drop PDF upload, calls backend, shows detected text fields.
 */

import { uploadTemplate } from '../api.js';
import { state, nextStep, showToast } from '../main.js';

export function renderStep1(container) {
    container.innerHTML = `
    <div class="card">
      <h2 class="card-title">Upload Certificate Template</h2>
      <p class="card-subtitle">Upload a PDF certificate with editable text layers. We'll detect all text fields automatically.</p>

      <div class="dropzone" id="dropzone">
        <span class="dropzone-icon">📄</span>
        <p class="dropzone-text">Drop your PDF here or click to browse</p>
        <p class="dropzone-hint">Supports .pdf files with text layers</p>
        <input type="file" id="pdfInput" accept=".pdf" />
      </div>

      <div id="uploadResult" style="display:none; margin-top:24px;">
        <div id="statusMsg"></div>
        <div id="fieldsContainer"></div>
        <div class="action-bar">
          <div></div>
          <button class="btn btn-primary" id="nextBtn">
            Continue to Fonts →
          </button>
        </div>
      </div>
    </div>
  `;

    const dropzone = container.querySelector('#dropzone');
    const input = container.querySelector('#pdfInput');
    const resultDiv = container.querySelector('#uploadResult');

    // Drag events
    ['dragenter', 'dragover'].forEach(evt => {
        dropzone.addEventListener(evt, (e) => {
            e.preventDefault();
            dropzone.classList.add('dragover');
        });
    });

    ['dragleave', 'drop'].forEach(evt => {
        dropzone.addEventListener(evt, (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
        });
    });

    dropzone.addEventListener('drop', (e) => {
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    });

    input.addEventListener('change', (e) => {
        if (e.target.files[0]) handleFile(e.target.files[0]);
    });

    async function handleFile(file) {
        if (!file.name.toLowerCase().endsWith('.pdf')) {
            showToast('Please upload a PDF file.', 'error');
            return;
        }

        // Show loading
        dropzone.innerHTML = `
      <span class="dropzone-icon">⏳</span>
      <p class="dropzone-text">Analyzing PDF...</p>
      <p class="dropzone-hint">${file.name}</p>
    `;

        try {
            const result = await uploadTemplate(file);

            if (result.status === 'error') {
                showToast(result.message, 'error');
                dropzone.innerHTML = `
          <span class="dropzone-icon">❌</span>
          <p class="dropzone-text">${result.message}</p>
          <p class="dropzone-hint">Try another file</p>
          <input type="file" id="pdfInput" accept=".pdf" />
        `;
                container.querySelector('#pdfInput').addEventListener('change', (e) => {
                    if (e.target.files[0]) handleFile(e.target.files[0]);
                });
                return;
            }

            // Store state
            state.fields = result.fields || [];
            state.fonts = result.fonts || null;

            // Update dropzone to show success
            dropzone.innerHTML = `
        <span class="dropzone-icon">✅</span>
        <p class="dropzone-text">${file.name}</p>
        <p class="dropzone-hint">${result.message}</p>
      `;
            dropzone.style.cursor = 'default';

            // Show results
            showResults(result, resultDiv, container);

        } catch (err) {
            showToast('Upload failed. Please try again.', 'error');
            console.error(err);
        }
    }

    container.querySelector('#nextBtn')?.addEventListener('click', () => nextStep());
}

function showResults(result, resultDiv, container) {
    resultDiv.style.display = 'block';

    // Status message
    const statusMsg = container.querySelector('#statusMsg');
    statusMsg.innerHTML = `
    <div class="status-message success">
      ✅ ${result.message}
    </div>
  `;

    // Fields list
    const fieldsContainer = container.querySelector('#fieldsContainer');

    if (result.fields && result.fields.length > 0) {
        let html = `<h3 style="margin-bottom:12px; font-size:1rem; color: var(--color-text-secondary);">Detected Text Fields</h3>`;
        html += `<div class="fields-list">`;

        for (const field of result.fields) {
            const colorDot = `<span style="width:12px;height:12px;border-radius:50%;background:${field.color};display:inline-block;border:1px solid rgba(255,255,255,0.2);"></span>`;

            html += `
        <div class="field-item">
          <div>
            <div class="field-text">"${escapeHtml(truncate(field.text, 50))}"</div>
          </div>
          <div class="field-meta">
            <span>🔤 ${escapeHtml(field.font)}</span>
            <span>📏 ${field.size}pt</span>
            <span>${colorDot}</span>
            <span>📐 ${field.alignment}</span>
          </div>
        </div>
      `;
        }

        html += `</div>`;
        fieldsContainer.innerHTML = html;
    }

    // Enable next button
    const nextBtn = container.querySelector('#nextBtn');
    if (nextBtn) nextBtn.style.display = 'inline-flex';
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function truncate(str, len) {
    return str.length > len ? str.slice(0, len) + '…' : str;
}
