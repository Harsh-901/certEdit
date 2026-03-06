/**
 * Step 4 — Column Mapping
 * Two-panel interface to map data columns to certificate text fields.
 */

import { validateMapping } from '../api.js';
import { state, nextStep, prevStep, showToast } from '../main.js';

export function renderStep4(container) {
    const { dataHeaders, dataPreview, fields } = state;

    if (!dataHeaders.length || !fields.length) {
        container.innerHTML = `
      <div class="card">
        <h2 class="card-title">Column Mapping</h2>
        <div class="status-message error">
          Missing data. Please complete the previous steps first.
        </div>
        <div class="action-bar">
          <button class="btn btn-secondary" id="backBtn">← Back</button>
          <div></div>
        </div>
      </div>
    `;
        container.querySelector('#backBtn').addEventListener('click', prevStep);
        return;
    }

    const sampleRow = dataPreview[0] || {};

    let html = `
    <div class="card">
      <h2 class="card-title">Map Data to Certificate</h2>
      <p class="card-subtitle">Connect your data columns to the text fields on your certificate. Each data column can map to one certificate field.</p>

      <div class="mapping-container">
        <!-- Left: Data Columns -->
        <div class="mapping-panel">
          <div class="mapping-panel-title">📊 Data Columns</div>
  `;

    for (const header of dataHeaders) {
        const sample = sampleRow[header] || '';
        html += `
      <div class="mapping-row" data-column="${escapeHtml(header)}">
        <div style="flex:1;">
          <div style="font-weight:600; font-size:0.9rem;">${escapeHtml(header)}</div>
          <div style="font-size:0.75rem; color:var(--color-text-muted); margin-top:2px;">
            e.g. "${escapeHtml(truncate(sample, 30))}"
          </div>
        </div>
        <div style="font-size:0.8rem; color:var(--color-primary-light);">→</div>
        <select class="mapping-select" data-column="${escapeHtml(header)}" id="map_${escapeHtml(header)}">
          <option value="">— Not mapped —</option>
  `;

        for (const field of fields) {
            const prevMapping = state.mappings[field.index.toString()] === header;
            html += `<option value="${field.index}" ${prevMapping ? 'selected' : ''}>
        "${escapeHtml(truncate(field.text, 30))}" (${field.font}, ${field.size}pt)
      </option>`;
        }

        html += `</select></div>`;
    }

    html += `</div>`;

    // Arrow
    html += `<div class="mapping-arrow">⟷</div>`;

    // Right: Certificate Fields
    html += `
        <div class="mapping-panel">
          <div class="mapping-panel-title">📄 Certificate Fields</div>
  `;

    for (const field of fields) {
        const colorDot = `<span style="width:10px;height:10px;border-radius:50%;background:${field.color};display:inline-block;border:1px solid rgba(255,255,255,0.2);"></span>`;

        html += `
      <div class="field-item" id="cert-field-${field.index}">
        <div>
          <div class="field-text">"${escapeHtml(truncate(field.text, 40))}"</div>
        </div>
        <div class="field-meta">
          <span>🔤 ${escapeHtml(field.font)}</span>
          <span>📏 ${field.size}pt</span>
          <span>${colorDot}</span>
        </div>
      </div>
    `;
    }

    html += `</div></div>`;

    // Name column selector
    html += `
    <div style="margin-top:24px; padding:16px; background:var(--color-bg-input); border-radius:var(--radius-md); border:1px solid var(--color-border);">
      <label style="font-size:0.85rem; font-weight:600; color:var(--color-text-secondary); display:block; margin-bottom:8px;">
        Which column contains the recipient's name? (used for file naming)
      </label>
      <select class="mapping-select" id="nameColumnSelect">
        <option value="">— Auto-name files —</option>
  `;

    for (const header of dataHeaders) {
        html += `<option value="${escapeHtml(header)}" ${state.nameColumn === header ? 'selected' : ''}>${escapeHtml(header)}</option>`;
    }

    html += `</select></div>`;

    // Warnings area
    html += `<div id="mappingWarnings"></div>`;

    // Actions
    html += `
      <div class="action-bar">
        <button class="btn btn-secondary" id="backBtn">← Back</button>
        <button class="btn btn-primary" id="nextBtn">Generate Preview →</button>
      </div>
    </div>
  `;

    container.innerHTML = html;

    // Handle mapping changes — highlight mapped rows
    const selects = container.querySelectorAll('.mapping-select[data-column]');
    selects.forEach(sel => {
        sel.addEventListener('change', () => {
            updateMappingState(container);
        });
    });

    container.querySelector('#nameColumnSelect').addEventListener('change', (e) => {
        state.nameColumn = e.target.value || null;
    });

    container.querySelector('#backBtn').addEventListener('click', prevStep);
    container.querySelector('#nextBtn').addEventListener('click', () => handleNext(container));

    // Initialize state from existing mappings
    updateMappingState(container);
}

function updateMappingState(container) {
    const selects = container.querySelectorAll('.mapping-select[data-column]');
    const mappings = {};

    selects.forEach(sel => {
        const column = sel.dataset.column;
        const fieldIdx = sel.value;
        const row = sel.closest('.mapping-row');

        if (fieldIdx) {
            mappings[fieldIdx] = column;
            row.classList.add('mapped');
        } else {
            row.classList.remove('mapped');
        }
    });

    state.mappings = mappings;

    // Highlight mapped certificate fields
    const allFieldItems = container.querySelectorAll('.field-item');
    allFieldItems.forEach(item => {
        const id = item.id.replace('cert-field-', '');
        if (mappings[id]) {
            item.style.borderColor = 'var(--color-primary)';
            item.style.background = 'rgba(108, 99, 255, 0.05)';
        } else {
            item.style.borderColor = '';
            item.style.background = '';
        }
    });
}

async function handleNext(container) {
    const mappings = state.mappings;

    if (Object.keys(mappings).length === 0) {
        showToast('Please map at least one data column to a certificate field.', 'error');
        return;
    }

    try {
        const result = await validateMapping(mappings, state.nameColumn);

        if (result.warnings && result.warnings.length > 0) {
            const warningsDiv = container.querySelector('#mappingWarnings');
            warningsDiv.innerHTML = `
        <div class="warnings-list" style="margin-top:16px;">
          ${result.warnings.map(w => `<p>⚠️ ${w}</p>`).join('')}
        </div>
      `;
            // Still allow proceeding
            showToast('Check the warnings below, then proceed if OK.', 'info');
        }

        if (result.status !== 'error') {
            nextStep();
        }
    } catch (err) {
        showToast('Validation failed.', 'error');
    }
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function truncate(str, len) {
    return str.length > len ? str.slice(0, len) + '…' : str;
}
