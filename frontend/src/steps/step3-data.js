/**
 * Step 3 — Data File Upload
 * Upload XLSX/CSV/JSON, parse and show preview table.
 */

import { uploadData } from '../api.js';
import { state, nextStep, prevStep, showToast } from '../main.js';

export function renderStep3(container) {
    container.innerHTML = `
    <div class="card">
      <h2 class="card-title">Upload Recipient Data</h2>
      <p class="card-subtitle">Upload a file with your certificate recipients. Supported formats: XLSX, CSV, JSON.</p>

      <div class="dropzone" id="dataDropzone">
        <span class="dropzone-icon">📊</span>
        <p class="dropzone-text">Drop your data file here or click to browse</p>
        <p class="dropzone-hint">Supports .xlsx, .csv, .json</p>
        <input type="file" id="dataInput" accept=".xlsx,.csv,.json" />
      </div>

      <div id="dataResult" style="display:none; margin-top:24px;">
        <div id="dataStatus"></div>
        <div id="dataPreview"></div>
        <div class="action-bar">
          <button class="btn btn-secondary" id="backBtn">← Back</button>
          <button class="btn btn-primary" id="nextBtn">Continue to Mapping →</button>
        </div>
      </div>

      <div class="action-bar" id="initialActions">
        <button class="btn btn-secondary" id="backBtnInit">← Back</button>
        <div></div>
      </div>
    </div>
  `;

    const dropzone = container.querySelector('#dataDropzone');
    const input = container.querySelector('#dataInput');

    // Drag events
    ['dragenter', 'dragover'].forEach(evt => {
        dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
    });
    ['dragleave', 'drop'].forEach(evt => {
        dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.remove('dragover'); });
    });

    dropzone.addEventListener('drop', (e) => {
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file, container);
    });

    input.addEventListener('change', (e) => {
        if (e.target.files[0]) handleFile(e.target.files[0], container);
    });

    container.querySelector('#backBtnInit').addEventListener('click', prevStep);
}

async function handleFile(file, container) {
    const dropzone = container.querySelector('#dataDropzone');

    dropzone.innerHTML = `
    <span class="dropzone-icon">⏳</span>
    <p class="dropzone-text">Parsing data...</p>
    <p class="dropzone-hint">${file.name}</p>
  `;

    try {
        const result = await uploadData(file);

        if (result.status === 'error') {
            showToast(result.message, 'error');
            resetDropzone(container);
            return;
        }

        state.dataHeaders = result.headers || [];
        state.dataPreview = result.preview || [];
        state.dataRowCount = result.row_count || 0;

        dropzone.innerHTML = `
      <span class="dropzone-icon">✅</span>
      <p class="dropzone-text">${file.name}</p>
      <p class="dropzone-hint">${result.message}</p>
    `;

        showDataPreview(result, container);
        showToast(result.message, 'success');

    } catch (err) {
        showToast('Failed to parse data file.', 'error');
        resetDropzone(container);
    }
}

function showDataPreview(result, container) {
    const resultDiv = container.querySelector('#dataResult');
    const initialActions = container.querySelector('#initialActions');
    resultDiv.style.display = 'block';
    if (initialActions) initialActions.style.display = 'none';

    // Status
    const statusDiv = container.querySelector('#dataStatus');
    statusDiv.innerHTML = `
    <div class="status-message success">
      ✅ ${result.row_count} records loaded${result.skipped_rows > 0 ? ` (${result.skipped_rows} empty rows skipped)` : ''}.
    </div>
  `;

    // Preview table
    const previewDiv = container.querySelector('#dataPreview');
    const headers = result.headers || [];
    const preview = result.preview || [];

    let html = `
    <h3 style="margin-bottom:12px; font-size:1rem; color: var(--color-text-secondary);">
      Data Preview <span style="font-weight:400; font-size:0.85rem;">(first ${preview.length} of ${result.row_count} rows)</span>
    </h3>
    <div style="overflow-x:auto;">
      <table class="data-table">
        <thead><tr>
  `;

    for (const h of headers) {
        html += `<th>${escapeHtml(h)}</th>`;
    }

    html += `</tr></thead><tbody>`;

    for (const row of preview) {
        html += `<tr>`;
        for (const h of headers) {
            html += `<td>${escapeHtml(row[h] || '')}</td>`;
        }
        html += `</tr>`;
    }

    html += `</tbody></table></div>`;
    previewDiv.innerHTML = html;

    // Wire up buttons
    container.querySelector('#backBtn').addEventListener('click', prevStep);
    container.querySelector('#nextBtn').addEventListener('click', nextStep);
}

function resetDropzone(container) {
    const dropzone = container.querySelector('#dataDropzone');
    dropzone.innerHTML = `
    <span class="dropzone-icon">📊</span>
    <p class="dropzone-text">Drop your data file here or click to browse</p>
    <p class="dropzone-hint">Supports .xlsx, .csv, .json</p>
    <input type="file" id="dataInput" accept=".xlsx,.csv,.json" />
  `;
    container.querySelector('#dataInput').addEventListener('change', (e) => {
        if (e.target.files[0]) handleFile(e.target.files[0], container);
    });
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
