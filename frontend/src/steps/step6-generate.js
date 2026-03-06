/**
 * Step 6 — Bulk Certificate Generation
 * Generates all certificates, shows progress, offers ZIP and merged PDF downloads.
 */

import { generateCertificates, getDownloadUrl } from '../api.js';
import { state, prevStep, showToast } from '../main.js';

export function renderStep6(container) {
    container.innerHTML = `
    <div class="card">
      <h2 class="card-title">Generate Certificates</h2>
      <p class="card-subtitle">Ready to generate ${state.dataRowCount} certificate(s) from your data.</p>

      <div id="preGenerate">
        <div class="status-message info">
          📋 ${Object.keys(state.mappings).length} field mapping(s) configured for ${state.dataRowCount} recipient(s).
        </div>

        <div class="action-bar">
          <button class="btn btn-secondary" id="backBtn">← Back to Preview</button>
          <button class="btn btn-primary" id="startBtn">
            🚀 Start Generation
          </button>
        </div>
      </div>

      <div id="generating" style="display:none;">
        <div class="progress-container">
          <div class="progress-bar-track">
            <div class="progress-bar-fill" id="progressFill" style="width:0%"></div>
          </div>
          <div class="progress-text" id="progressText">Preparing...</div>
        </div>
      </div>

      <div id="completed" style="display:none;">
        <div class="status-message success" id="completedMsg"></div>

        <div class="download-grid">
          <a class="download-card" id="downloadZip" href="#" download>
            <div class="download-icon">📦</div>
            <div class="download-title">Download as ZIP</div>
            <div class="download-desc">Individual PDF files, one per certificate</div>
          </a>
          <a class="download-card" id="downloadMerged" href="#" download>
            <div class="download-icon">📑</div>
            <div class="download-title">Download Merged PDF</div>
            <div class="download-desc">All certificates in one multi-page PDF</div>
          </a>
        </div>

        <div id="warningsArea"></div>
      </div>
    </div>
  `;

    container.querySelector('#backBtn').addEventListener('click', prevStep);
    container.querySelector('#startBtn').addEventListener('click', () => startGeneration(container));
}

async function startGeneration(container) {
    const preGenDiv = container.querySelector('#preGenerate');
    const genDiv = container.querySelector('#generating');
    const completedDiv = container.querySelector('#completed');

    preGenDiv.style.display = 'none';
    genDiv.style.display = 'block';

    const progressFill = container.querySelector('#progressFill');
    const progressText = container.querySelector('#progressText');

    // Simulate initial progress (actual generation is server-side)
    progressText.textContent = `Generating ${state.dataRowCount} certificate(s)...`;
    progressFill.style.width = '10%';

    // Start a progress animation while waiting
    let fakeProgress = 10;
    const progressInterval = setInterval(() => {
        fakeProgress = Math.min(fakeProgress + Math.random() * 5, 90);
        progressFill.style.width = `${fakeProgress}%`;
        const estimatedDone = Math.floor(fakeProgress / 100 * state.dataRowCount);
        progressText.textContent = `Generating certificate ${estimatedDone} of ${state.dataRowCount}...`;
    }, 500);

    try {
        const result = await generateCertificates(state.mappings, state.nameColumn);

        clearInterval(progressInterval);

        if (result.status === 'error') {
            showToast(result.message, 'error');
            preGenDiv.style.display = 'block';
            genDiv.style.display = 'none';
            return;
        }

        // Complete!
        progressFill.style.width = '100%';
        progressText.textContent = `Done! Generated ${result.count} certificates.`;

        setTimeout(() => {
            genDiv.style.display = 'none';
            completedDiv.style.display = 'block';

            container.querySelector('#completedMsg').textContent =
                `✅ Successfully generated ${result.count} of ${result.total} certificates.`;

            container.querySelector('#downloadZip').href = getDownloadUrl('zip');
            container.querySelector('#downloadMerged').href = getDownloadUrl('merged');

            // Show warnings if any
            if (result.warnings && result.warnings.length > 0) {
                const warningsArea = container.querySelector('#warningsArea');
                warningsArea.innerHTML = `
          <div class="warnings-list" style="margin-top:24px;">
            <p style="font-weight:600; margin-bottom:8px; color:var(--color-warning);">⚠️ Warnings (${result.warnings.length}):</p>
            ${result.warnings.map(w => `<p>${w}</p>`).join('')}
          </div>
        `;
            }

            showToast(`${result.count} certificates ready for download!`, 'success');
        }, 800);

    } catch (err) {
        clearInterval(progressInterval);
        showToast('Generation failed. Please try again.', 'error');
        preGenDiv.style.display = 'block';
        genDiv.style.display = 'none';
        console.error(err);
    }
}
