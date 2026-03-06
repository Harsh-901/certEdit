import React, { useEffect, useRef, useState, useCallback } from 'react';
import { getTemplatePdfUrl, validateMapping } from '../api';
import * as pdfjsLib from 'pdfjs-dist';

// Use the worker file copied to public/
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

const RENDER_SCALE = 1.5;

export default function FieldMapping({
    fields, columns, previewRows, pageWidth, pageHeight,
    mappings, setMappings, nameColumn, setNameColumn,
    onComplete, onBack, addToast,
}) {
    const canvasRef = useRef(null);
    const textLayerRef = useRef(null);
    const wrapperRef = useRef(null);
    const [pdfLoaded, setPdfLoaded] = useState(false);
    const [loading, setLoading] = useState(false);
    const [renderError, setRenderError] = useState(null);
    const [textItems, setTextItems] = useState([]);
    const [activeItem, setActiveItem] = useState(null);
    const [dropdownPos, setDropdownPos] = useState(null);
    const [canvasDims, setCanvasDims] = useState({ w: 0, h: 0 });

    // Render PDF on canvas + extract text layer
    useEffect(() => {
        const url = getTemplatePdfUrl();
        if (!url) {
            setRenderError('No template URL available.');
            return;
        }

        let cancelled = false;

        const loadPdf = async () => {
            try {
                const pdf = await pdfjsLib.getDocument(url).promise;
                const page = await pdf.getPage(1);

                // Use the page's default rotation so it renders correctly
                const viewport = page.getViewport({ scale: RENDER_SCALE });

                const canvas = canvasRef.current;
                if (!canvas || cancelled) return;
                canvas.width = viewport.width;
                canvas.height = viewport.height;

                const ctx = canvas.getContext('2d');
                await page.render({ canvasContext: ctx, viewport }).promise;

                setCanvasDims({ w: viewport.width, h: viewport.height });

                // Extract text content for clickable text layer
                const content = await page.getTextContent();
                const items = [];

                content.items.forEach((item, idx) => {
                    if (!item.str || !item.str.trim()) return;

                    const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);

                    // tx is [scaleX, skewY, skewX, scaleY, translateX, translateY]
                    const fontSize = Math.sqrt(tx[0] * tx[0] + tx[1] * tx[1]);
                    const x = tx[4];
                    const y = tx[5];

                    // Text height ≈ fontSize, width from item.width scaled
                    const width = item.width * RENDER_SCALE;
                    const height = fontSize;

                    items.push({
                        id: `text_${idx}`,
                        text: item.str,
                        x: x,
                        y: y - height,   // PDF text baseline → top-left
                        width: Math.max(width, 20),
                        height: Math.max(height, 10),
                        fontName: item.fontName || '',
                        fontSize: fontSize / RENDER_SCALE,
                    });
                });

                setTextItems(items);
                setPdfLoaded(true);
                setRenderError(null);
            } catch (err) {
                console.error('[FieldMapping] PDF render error:', err);
                if (!cancelled) {
                    setRenderError(`Failed to render PDF: ${err.message}`);
                    addToast('Failed to render PDF template.', 'error');
                }
            }
        };

        loadPdf();
        return () => { cancelled = true; };
    }, [addToast]);

    // Handle text click → show dropdown
    const handleTextClick = useCallback((item, e) => {
        e.stopPropagation();
        if (activeItem === item.id) {
            setActiveItem(null);
            setDropdownPos(null);
            return;
        }
        setActiveItem(item.id);

        const wrapper = wrapperRef.current;
        if (wrapper) {
            const wRect = wrapper.getBoundingClientRect();
            setDropdownPos({
                left: Math.min(item.x, wRect.width - 240),
                top: item.y + item.height + 4,
            });
        }
    }, [activeItem]);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClick = () => {
            setActiveItem(null);
            setDropdownPos(null);
        };
        document.addEventListener('click', handleClick);
        return () => document.removeEventListener('click', handleClick);
    }, []);

    // Map a column to a text item
    const handleMap = useCallback((itemId, column) => {
        setMappings(prev => ({ ...prev, [itemId]: column }));
        setActiveItem(null);
        setDropdownPos(null);
    }, [setMappings]);

    // Clear a mapping
    const handleClear = useCallback((itemId) => {
        setMappings(prev => {
            const next = { ...prev };
            delete next[itemId];
            return next;
        });
        setActiveItem(null);
        setDropdownPos(null);
    }, [setMappings]);

    // Submit mappings — remap text_idx keys → field IDs for the backend
    const handleContinue = async () => {
        if (Object.keys(mappings).length === 0) {
            addToast('Map at least one field before continuing.', 'warning');
            return;
        }

        // Build mappings keyed by field_id for the backend
        // Match selected text items to the closest backend-detected field
        const backendMappings = {};
        for (const [itemId, column] of Object.entries(mappings)) {
            const item = textItems.find(t => t.id === itemId);
            if (!item) continue;

            // Find the backend field whose text matches (or is closest)
            const matchedField = fields.find(f =>
                f.text.trim() === item.text.trim()
            ) || fields.find(f =>
                item.text.trim().includes(f.text.trim()) || f.text.trim().includes(item.text.trim())
            );

            if (matchedField) {
                backendMappings[matchedField.id] = column;
            } else {
                // Fallback: match by position proximity
                let bestField = null;
                let bestDist = Infinity;
                for (const f of fields) {
                    const fx = f.bbox[0];
                    const fy = f.bbox[1];
                    const ix = item.x / RENDER_SCALE;
                    const iy = item.y / RENDER_SCALE;
                    const dist = Math.sqrt((fx - ix) ** 2 + (fy - iy) ** 2);
                    if (dist < bestDist) {
                        bestDist = dist;
                        bestField = f;
                    }
                }
                if (bestField && bestDist < 50) {
                    backendMappings[bestField.id] = column;
                } else {
                    addToast(`Could not match "${item.text}" to a backend field.`, 'warning');
                }
            }
        }

        if (Object.keys(backendMappings).length === 0) {
            addToast('No valid field mappings found. Try selecting different text.', 'error');
            return;
        }

        setLoading(true);
        try {
            const res = await validateMapping(backendMappings, nameColumn);
            if (res.status === 'error') {
                addToast(res.message, 'error');
            } else {
                if (res.warnings?.length) {
                    res.warnings.forEach(w => addToast(w, 'warning'));
                }
                // Store the backend-compatible mappings for subsequent steps
                setMappings(backendMappings);
                onComplete();
            }
        } catch {
            addToast('Validation failed.', 'error');
        }
        setLoading(false);
    };

    const sampleRow = previewRows?.[0] || {};

    return (
        <div className="card">
            <h2 className="card-title">Map Fields to Data</h2>
            <p className="card-subtitle">
                Click on any text in the certificate to select it, then choose which data column should replace it.
            </p>

            <div className="mapping-container">
                {/* PDF Canvas with text layer */}
                <div
                    className="pdf-canvas-wrapper"
                    ref={wrapperRef}
                    style={{
                        position: 'relative',
                        width: canvasDims.w || Math.min(pageWidth * RENDER_SCALE, 700),
                        height: canvasDims.h || Math.min(pageHeight * RENDER_SCALE, 500),
                    }}
                >
                    <canvas ref={canvasRef} style={{ display: 'block' }} />

                    {/* Clickable text layer */}
                    {pdfLoaded && (
                        <div
                            ref={textLayerRef}
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: canvasDims.w,
                                height: canvasDims.h,
                                pointerEvents: 'none',
                            }}
                        >
                            {textItems.map(item => {
                                const isMapped = !!mappings[item.id];
                                const isActive = activeItem === item.id;

                                return (
                                    <div
                                        key={item.id}
                                        className={`text-select-overlay${isMapped ? ' mapped' : ''}${isActive ? ' active' : ''}`}
                                        style={{
                                            position: 'absolute',
                                            left: item.x,
                                            top: item.y,
                                            width: item.width,
                                            height: item.height,
                                            pointerEvents: 'auto',
                                            cursor: 'pointer',
                                        }}
                                        onClick={(e) => handleTextClick(item, e)}
                                        title={item.text}
                                    >
                                        {(isMapped || isActive) && (
                                            <div className="field-overlay-label">
                                                {isMapped ? mappings[item.id] : item.text}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {!pdfLoaded && !renderError && (
                        <div className="loading-overlay" style={{ position: 'absolute', inset: 0 }}>
                            <div className="spinner" />
                            <div className="loading-text">Loading certificate…</div>
                        </div>
                    )}

                    {renderError && (
                        <div style={{
                            position: 'absolute', inset: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexDirection: 'column', gap: 8, padding: 20,
                            background: 'rgba(0,0,0,0.5)', color: 'var(--error)',
                            fontSize: 13, textAlign: 'center',
                        }}>
                            <span>⚠ {renderError}</span>
                        </div>
                    )}

                    {/* Column mapping dropdown */}
                    {activeItem && dropdownPos && (
                        <div
                            className="mapping-dropdown"
                            style={{
                                position: 'absolute',
                                left: dropdownPos.left,
                                top: dropdownPos.top,
                                zIndex: 50,
                            }}
                            onClick={e => e.stopPropagation()}
                        >
                            {mappings[activeItem] && (
                                <div
                                    className="mapping-dropdown-item clear-btn"
                                    onClick={() => handleClear(activeItem)}
                                >
                                    ✕ Clear mapping
                                </div>
                            )}
                            {columns.map(col => (
                                <div
                                    key={col}
                                    className="mapping-dropdown-item"
                                    onClick={() => handleMap(activeItem, col)}
                                >
                                    <div className="col-name">{col}</div>
                                    <div className="col-sample">{sampleRow[col] || '—'}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Mapping sidebar */}
                <div className="mapping-sidebar">
                    <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--text-secondary)' }}>
                        Active Mappings
                    </h3>

                    {Object.keys(mappings).length === 0 ? (
                        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                            No mappings yet. Click on any text in the certificate to select it.
                        </p>
                    ) : (
                        <div className="mapping-list">
                            {Object.entries(mappings).map(([itemId, col]) => {
                                const item = textItems.find(t => t.id === itemId);
                                return (
                                    <div key={itemId} className="mapping-entry">
                                        <span className="field-label" title={item?.text}>{item?.text || itemId}</span>
                                        <span className="arrow">→</span>
                                        <span className="column-label">{col}</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Name column selector */}
                    {columns.length > 0 && (
                        <div style={{ marginTop: 20 }}>
                            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                                Filename Column (for naming PDFs)
                            </label>
                            <select
                                value={nameColumn || ''}
                                onChange={(e) => setNameColumn(e.target.value || null)}
                                style={{
                                    width: '100%',
                                    padding: '8px 12px',
                                    background: 'var(--bg-input)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: 'var(--radius-sm)',
                                    color: 'var(--text-primary)',
                                    fontSize: 13,
                                    fontFamily: 'var(--font-ui)',
                                }}
                            >
                                <option value="">Auto (certificate_1, certificate_2…)</option>
                                {columns.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="btn-row" style={{ flexDirection: 'column' }}>
                        <button
                            className="btn btn-primary"
                            onClick={handleContinue}
                            disabled={Object.keys(mappings).length === 0 || loading}
                            style={{ width: '100%' }}
                        >
                            {loading ? <><div className="spinner" /> Validating…</> : 'Continue to Preview →'}
                        </button>
                        <button className="btn btn-ghost" onClick={onBack} style={{ width: '100%' }}>
                            ← Back
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
