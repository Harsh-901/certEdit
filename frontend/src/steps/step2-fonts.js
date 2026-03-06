/**
 * Step 2 — Font Detection & Handling
 * Shows font availability, suggests replacements for missing fonts.
 */

import { selectFont } from '../api.js';
import { state, nextStep, prevStep, showToast } from '../main.js';

export function renderStep2(container) {
    const fonts = state.fonts;

    if (!fonts || !fonts.results) {
        container.innerHTML = `
      <div class="card">
        <h2 class="card-title">Font Detection</h2>
        <div class="status-message error">No font data available. Please go back and upload a template.</div>
        <div class="action-bar">
          <button class="btn btn-secondary" id="backBtn">← Back</button>
          <div></div>
        </div>
      </div>
    `;
        container.querySelector('#backBtn').addEventListener('click', prevStep);
        return;
    }

    const allAvailable = fonts.results.every(f => f.available);

    let html = `
    <div class="card">
      <h2 class="card-title">Font Detection</h2>
      <p class="card-subtitle">${fonts.message}</p>

      <div class="status-message ${allAvailable ? 'success' : 'info'}">
        ${allAvailable ? '✅' : 'ℹ️'} ${fonts.message}
      </div>

      <div id="fontsList">
  `;

    for (const fontResult of fonts.results) {
        if (fontResult.available) {
            html += `
        <div class="font-card available">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div class="font-name">${escapeHtml(fontResult.detected)}</div>
              <div class="font-status">
                ${fontResult.is_alias
                    ? `Matched to <strong>${fontResult.matched_to}</strong> (similar font)`
                    : `Available ✓`
                }
              </div>
            </div>
            <span class="badge badge-success">Ready</span>
          </div>
        </div>
      `;
        } else {
            html += `
        <div class="font-card missing">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div class="font-name">${escapeHtml(fontResult.detected)}</div>
              <div class="font-status">Not available in the font library</div>
            </div>
            <span class="badge badge-warning">Needs Replacement</span>
          </div>
          <div class="font-suggestions" data-original="${escapeHtml(fontResult.detected)}">
            <p style="font-size:0.8rem; color:var(--color-text-muted); margin-bottom:4px;">Select a replacement:</p>
      `;

            if (fontResult.suggestions) {
                for (const sug of fontResult.suggestions) {
                    html += `
            <label class="font-suggestion" data-font="${escapeHtml(sug.name)}">
              <input type="radio" name="font_${escapeHtml(fontResult.detected)}" value="${escapeHtml(sug.name)}" />
              <div>
                <div class="font-suggestion-name">${escapeHtml(sug.name)}</div>
                <div class="font-suggestion-reason">${escapeHtml(sug.reason)}</div>
              </div>
            </label>
          `;
                }
            }

            html += `</div></div>`;
        }
    }

    html += `
      </div>
      <div class="action-bar">
        <button class="btn btn-secondary" id="backBtn">← Back</button>
        <button class="btn btn-primary" id="nextBtn" ${allAvailable ? '' : 'disabled'}>
          ${allAvailable ? 'Continue to Data Upload →' : 'Select all replacements to continue'}
        </button>
      </div>
    </div>
  `;

    container.innerHTML = html;

    // If all fonts available, auto-skip or let user proceed
    if (allAvailable) {
        showToast('Fonts loaded. Ready to map your data.', 'success');
    }

    // Handle font selection
    const radios = container.querySelectorAll('input[type="radio"]');
    radios.forEach(radio => {
        radio.addEventListener('change', async (e) => {
            const sugContainer = e.target.closest('.font-suggestion');
            const allSugs = e.target.closest('.font-suggestions').querySelectorAll('.font-suggestion');
            allSugs.forEach(s => s.classList.remove('selected'));
            sugContainer.classList.add('selected');

            const originalFont = e.target.closest('.font-suggestions').dataset.original;
            const replacementFont = e.target.value;

            try {
                const result = await selectFont(originalFont, replacementFont);
                if (result.status === 'success') {
                    showToast(result.message, 'success');
                }
            } catch (err) {
                showToast('Failed to set replacement font.', 'error');
            }

            // Check if all missing fonts now have selections
            checkAllFontsSelected(container);
        });
    });

    container.querySelector('#backBtn').addEventListener('click', prevStep);
    container.querySelector('#nextBtn').addEventListener('click', () => nextStep());
}

function checkAllFontsSelected(container) {
    const missingFonts = container.querySelectorAll('.font-card.missing');
    let allSelected = true;

    missingFonts.forEach(card => {
        const checked = card.querySelector('input[type="radio"]:checked');
        if (!checked) allSelected = false;
    });

    const nextBtn = container.querySelector('#nextBtn');
    if (nextBtn) {
        nextBtn.disabled = !allSelected;
        nextBtn.textContent = allSelected ? 'Continue to Data Upload →' : 'Select all replacements to continue';
    }
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
