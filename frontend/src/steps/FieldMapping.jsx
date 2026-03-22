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
                const viewport = page.getViewport({ scale: RENDER_SCALE, rotation: page.rotate });

                const canvas = canvasRef.current;
                if (!canvas || cancelled) return;
                canvas.width = viewport.width;
                canvas.height = viewport.height;

                const ctx = canvas.getContext('2d');
                await page.render({ canvasContext: ctx, viewport }).promise;

                setCanvasDims({ w: viewport.width, h: viewport.height });

                // Build clickable overlay items directly from backend fields prop
                // This ensures item IDs match backend field IDs (field_0, field_1, etc.)
                const items = fields.map(f => {
                    // PyMuPDF bbox is [x0, y0, x1, y1] in PDF points (bottom-left origin)
                    // PDF.js viewport.convertToViewportPoint handles the coordinate conversion
                    const [x0, y0, x1, y1] = f.bbox;

                    // PyMuPDF uses top-left origin. PDF.js convertToViewportPoint 
                    // expects standard PDF coordinates (bottom-left origin).
                    // We must flip the y-axis relative to pageHeight.
                    const pt0 = viewport.convertToViewportPoint(x0, pageHeight - y0);
                    const pt1 = viewport.convertToViewportPoint(x1, pageHeight - y1);

                    const left = Math.min(pt0[0], pt1[0]);
                    const top = Math.min(pt0[1], pt1[1]);
                    const width = Math.abs(pt1[0] - pt0[0]);
                    const height = Math.abs(pt1[1] - pt0[1]);

                    return {
                        id: f.id,          // field_0, field_1 etc — matches backend directly
                        text: f.text,
                        x: left,
                        y: top,
                        width: Math.max(width, 30),
                        height: Math.max(height, 14),
                    };
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
    }, [fields, addToast]);

    // Auto-map fields
    const hasAutoMapped = useRef(false);
    useEffect(() => {
        if (!fields || !columns || hasAutoMapped.current || Object.keys(mappings).length > 0) return;

        const initialMappings = {};
        let mappedCount = 0;

        fields.forEach(f => {
            const text = f.text.trim();
            
            let cleanText = text.toLowerCase();
            const match = text.match(/\[(.*?)\]|\{(.*?)\}/);
            
            if (match) {
                // If there's a bracketed portion, use its content for auto-mapping
                cleanText = (match[1] || match[2]).trim().toLowerCase();
            } else {
                // Otherwise fallback to removing full-string brackets
                cleanText = text.replace(/^\[+/, '').replace(/\]+$/, '')
                                .replace(/^\{+/, '').replace(/\}+$/, '').trim().toLowerCase();
            }

            const matchedCol = columns.find(c => c.toLowerCase() === cleanText);
            if (matchedCol) {
                initialMappings[f.id] = matchedCol;
                mappedCount++;
            }
        });

        if (mappedCount > 0) {
            setMappings(initialMappings);
            addToast(`Auto-mapped ${mappedCount} fields!`, 'success');
        }
        hasAutoMapped.current = true;
    }, [fields, columns, mappings, setMappings, addToast]);

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

        // No translation needed — overlay items use field_id directly
        const backendMappings = { ...mappings };

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
