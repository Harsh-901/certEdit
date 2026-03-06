/**
 * Step 5 — Live Preview
 * Shows a before/after toggle of the certificate with first row data.
 */

import { generatePreview } from '../api.js';
import { state, nextStep, prevStep, showToast } from '../main.js';

export function renderStep5(container) {
    container.innerHTML = `
    <div class="card" style="position:relative;">
      <h2 class="card-title">Certificate Preview</h2>
      <p class="card-subtitle">Review the generated certificate with data from the first row before bulk generation.</p>

      <div class="loading-overlay" id="loadingOverlay">
        <div style="text-align:center;">
          <div class="spinner" style="width:40px;height:40px;border-width:3px;margin:0 auto 12px;"></div>
          <p style="color:var(--color-text-secondary);">Generating preview...</p>
        </div>
      </div>

      <div id="previewContent" style="display:none;">
        <div class="preview-toggle" id="previewToggle">
          <button class="preview-toggle-btn active" data-view="filled" id="btnFilled">Filled Certificate</button>
          <button class="preview-toggle-btn" data-view="template" id="btnTemplate">Original Template</button>
        </div>

        <div class="preview-frame" id="previewFrame">
          <iframe id="pdfViewer" title="Certificate Preview"></iframe>
        </div>

        <div id="previewData" style="margin-top:16px;"></div>
      </div>

      <div class="action-bar" style="margin-top:24px;">
        <button class="btn btn-secondary" id="backBtn">← Adjust Mappings</button>
        <button class="btn btn-success" id="generateBtn" disabled>
          ✅ Looks Good — Generate All
        </button>
      </div>
    </div>
  `;

    let previewPdf = null;
    let templatePdf = null;

    // Generate the preview
    generatePreviewCert();

    async function generatePreviewCert() {
        try {
            const result = await generatePreview(state.mappings);

            if (result.status === 'error') {
                showToast(result.message, 'error');
                container.querySelector('#loadingOverlay').style.display = 'none';
                return;
            }

            previewPdf = result.preview_pdf;
            templatePdf = result.template_pdf;

            // Show preview
            container.querySelector('#loadingOverlay').style.display = 'none';
            container.querySelector('#previewContent').style.display = 'block';
            container.querySelector('#generateBtn').disabled = false;

            // Display filled certificate
            showPdf(previewPdf);

            // Show data used
            if (result.preview_data) {
                const dataDiv = container.querySelector('#previewData');
                let dataHtml = `<p style="font-size:0.8rem; color:var(--color-text-muted); margin-bottom:8px;">Data used for preview (row 1):</p>`;
                dataHtml += `<div style="display:flex; gap:12px; flex-wrap:wrap;">`;
                for (const [key, val] of Object.entries(result.preview_data)) {
                    dataHtml += `<span class="badge badge-success" style="font-size:0.7rem;">${key}: ${val}</span>`;
                }
                dataHtml += `</div>`;
                dataDiv.innerHTML = dataHtml;
            }

            showToast('Preview ready.', 'success');

        } catch (err) {
            showToast('Failed to generate preview.', 'error');
            container.querySelector('#loadingOverlay').style.display = 'none';
            console.error(err);
        }
    }

    function showPdf(base64) {
        const iframe = container.querySelector('#pdfViewer');
        iframe.src = `data:application/pdf;base64,${base64}`;
    }

    // Toggle buttons
    container.querySelector('#btnFilled').addEventListener('click', () => {
        if (previewPdf) showPdf(previewPdf);
        container.querySelector('#btnFilled').classList.add('active');
        container.querySelector('#btnTemplate').classList.remove('active');
    });

    container.querySelector('#btnTemplate').addEventListener('click', () => {
        if (templatePdf) showPdf(templatePdf);
        container.querySelector('#btnTemplate').classList.add('active');
        container.querySelector('#btnFilled').classList.remove('active');
    });

    container.querySelector('#backBtn').addEventListener('click', prevStep);
    container.querySelector('#generateBtn').addEventListener('click', nextStep);
}
