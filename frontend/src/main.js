/**
 * CertEdit — Main Application Controller
 * Manages step navigation, global state, and step rendering.
 */

import { renderStep1 } from './steps/step1-upload.js';
import { renderStep2 } from './steps/step2-fonts.js';
import { renderStep3 } from './steps/step3-data.js';
import { renderStep4 } from './steps/step4-mapping.js';
import { renderStep5 } from './steps/step5-preview.js';
import { renderStep6 } from './steps/step6-generate.js';

// Global application state
export const state = {
    currentStep: 1,
    fields: [],
    fonts: null,
    dataHeaders: [],
    dataPreview: [],
    dataRowCount: 0,
    mappings: {},
    nameColumn: null,
};

const stepRenderers = {
    1: renderStep1,
    2: renderStep2,
    3: renderStep3,
    4: renderStep4,
    5: renderStep5,
    6: renderStep6,
};

/**
 * Navigate to a specific step.
 */
export function goToStep(step) {
    if (step < 1 || step > 6) return;
    state.currentStep = step;
    updateStepIndicator();
    renderCurrentStep();
}

/**
 * Move to the next step.
 */
export function nextStep() {
    goToStep(state.currentStep + 1);
}

/**
 * Move to the previous step.
 */
export function prevStep() {
    goToStep(state.currentStep - 1);
}

/**
 * Update the step indicator bar at the top.
 */
function updateStepIndicator() {
    const steps = document.querySelectorAll('.step');
    const lines = document.querySelectorAll('.step-line');

    steps.forEach((stepEl, index) => {
        const stepNum = index + 1;
        stepEl.classList.remove('active', 'completed');

        if (stepNum === state.currentStep) {
            stepEl.classList.add('active');
        } else if (stepNum < state.currentStep) {
            stepEl.classList.add('completed');
        }
    });

    lines.forEach((line, index) => {
        line.classList.remove('completed');
        if (index + 1 < state.currentStep) {
            line.classList.add('completed');
        }
    });
}

/**
 * Render the current step's content.
 */
function renderCurrentStep() {
    const container = document.getElementById('stepContent');
    const renderer = stepRenderers[state.currentStep];

    if (renderer) {
        container.innerHTML = '';
        const panel = document.createElement('div');
        panel.className = 'step-panel';
        renderer(panel);
        container.appendChild(panel);
    }
}

/**
 * Show a toast notification.
 */
export function showToast(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('hiding');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
    updateStepIndicator();
    renderCurrentStep();
});
