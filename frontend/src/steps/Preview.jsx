import React, { useState, useEffect, useRef } from 'react';
import { generatePreview, getTemplatePdfUrl } from '../api';
import * as pdfjsLib from 'pdfjs-dist';

// Use the worker file copied to public/
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

const PREVIEW_SCALE = 1.2;

export default function Preview({ mappings, onComplete, onBack, addToast }) {
    const [loading, setLoading] = useState(false);
    const [previewData, setPreviewData] = useState(null);
    const templateCanvasRef = useRef(null);
    const previewCanvasRef = useRef(null);

    // Render a PDF (from URL or base64) onto a canvas
    const renderPdf = async (source, canvasRef, isBase64 = false) => {
        try {
            let loadingTask;
            if (isBase64) {
                const binary = atob(source);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                loadingTask = pdfjsLib.getDocument({ data: bytes });
            } else {
                loadingTask = pdfjsLib.getDocument(source);
            }

            const pdf = await loadingTask.promise;
            const page = await pdf.getPage(1);
            const viewport = page.getViewport({ scale: PREVIEW_SCALE, rotation: page.rotate });

            const canvas = canvasRef.current;
            if (!canvas) return;
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            await page.render({
                canvasContext: canvas.getContext('2d'),
                viewport,
            }).promise;
        } catch (err) {
            console.error('[Preview] PDF render error:', err);
        }
    };

    // Generate preview
    const handleGenerate = async () => {
        setLoading(true);
        try {
            const res = await generatePreview(mappings);
            if (res.status === 'error') {
                addToast(res.message, 'error');
                setLoading(false);
                return;
            }
            setPreviewData(res);
            addToast('Preview generated.', 'success');
        } catch {
            addToast('Preview generation failed.', 'error');
        }
        setLoading(false);
    };

    // Auto-generate on mount
    useEffect(() => {
        handleGenerate();
    }, []); // eslint-disable-line

    // Render PDFs when preview data is available
    useEffect(() => {
        if (!previewData) return;

        // Render template
        const templateUrl = getTemplatePdfUrl();
        if (templateUrl) {
            renderPdf(templateUrl, templateCanvasRef);
        }

        // Render preview
        if (previewData.pdf_base64) {
            renderPdf(previewData.pdf_base64, previewCanvasRef, true);
        }
    }, [previewData]);

    return (
        <div className="card" style={{ position: 'relative' }}>
            {loading && (
                <div className="loading-overlay">
                    <div className="spinner" />
                    <div className="loading-text">Generating preview…</div>
                </div>
            )}

            <h2 className="card-title">Preview Certificate</h2>
            <p className="card-subtitle">
                Compare the original template with a generated sample using the first data row.
            </p>

            {previewData && (
                <>
                    {/* Data used */}
                    {previewData.preview_row && (
                        <div style={{
                            padding: '10px 16px',
                            background: 'var(--bg-input)',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--border-color)',
                            fontSize: 13,
                            marginBottom: 20,
                            color: 'var(--text-secondary)',
                        }}>
                            <strong style={{ color: 'var(--text-primary)' }}>Sample data: </strong>
                            {Object.entries(previewData.preview_row).slice(0, 4).map(([k, v]) => (
                                <span key={k} style={{ marginRight: 16 }}>
                                    <span style={{ color: 'var(--text-muted)' }}>{k}:</span>{' '}
                                    <span style={{ color: 'var(--text-accent)' }}>{v}</span>
                                </span>
                            ))}
                        </div>
                    )}

                    <div className="preview-container">
                        <div className="preview-panel">
                            <div className="preview-panel-label">Original Template</div>
                            <canvas ref={templateCanvasRef} />
                        </div>
                        <div className="preview-panel">
                            <div className="preview-panel-label">Generated Preview</div>
                            <canvas ref={previewCanvasRef} />
                        </div>
                    </div>
                </>
            )}

            <div className="btn-row">
                <button className="btn btn-ghost" onClick={onBack}>← Back</button>
                <button className="btn btn-secondary" onClick={handleGenerate} disabled={loading}>
                    ↻ Regenerate
                </button>
                <button
                    className="btn btn-primary"
                    onClick={onComplete}
                    disabled={!previewData}
                >
                    Looks Good — Generate All →
                </button>
            </div>
        </div>
    );
}
