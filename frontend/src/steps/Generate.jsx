import React, { useState, useCallback } from 'react';
import {
    generateCertificatesStream,
    generateCertificates,
    getDownloadUrl,
} from '../api';

const FORMAT_OPTIONS = [
    {
        value: 'pdf',
        label: 'PDF',
        icon: '📄',
        desc: 'Editable, vector PDF files',
    },
    {
        value: 'png',
        label: 'PNG',
        icon: '🖼️',
        desc: 'High-res image files (200 DPI)',
    },
    {
        value: 'both',
        label: 'Both',
        icon: '📦',
        desc: 'PDF + PNG in separate ZIPs',
    },
];

export default function Generate({ mappings, nameColumn, totalRows, onBack, addToast }) {
    const [status, setStatus] = useState('idle'); // idle | generating | done | error
    const [progress, setProgress] = useState({ current: 0, total: 0, name: '' });
    const [result, setResult] = useState(null);
    const [exportFormat, setExportFormat] = useState('pdf');

    const handleGenerate = useCallback(() => {
        if (Object.keys(mappings).length === 0) {
            addToast('No mappings defined.', 'error');
            return;
        }

        setStatus('generating');
        setProgress({ current: 0, total: totalRows, name: '' });

        generateCertificatesStream(
            mappings,
            nameColumn,
            exportFormat,
            // onProgress
            (msg) => {
                setProgress({
                    current: msg.progress,
                    total: msg.total,
                    name: msg.current_name,
                });
            },
            // onComplete
            (msg) => {
                setStatus('done');
                setResult(msg);
                addToast(`${msg.count} certificates ready to download.`, 'success');
            },
            // onError
            (errMsg) => {
                setStatus('error');
                addToast(errMsg || 'Generation failed.', 'error');
                // Fallback to sync generation
                generateCertificates(mappings, nameColumn, exportFormat).then((data) => {
                    if (data.status === 'success') {
                        setStatus('done');
                        setResult(data);
                        addToast(`${data.count} certificates ready.`, 'success');
                    }
                });
            },
        );
    }, [mappings, nameColumn, totalRows, exportFormat, addToast]);

    const pct = progress.total > 0
        ? Math.round((progress.current / progress.total) * 100)
        : 0;

    return (
        <div className="card">
            <h2 className="card-title">Generate Certificates</h2>
            <p className="card-subtitle">
                {status === 'idle' && `Ready to generate ${totalRows} certificates.`}
                {status === 'generating' && 'Generation in progress…'}
                {status === 'done' && `${result?.count || 0} certificates ready to download.`}
                {status === 'error' && 'An error occurred. Retrying…'}
            </p>

            {/* Export format selector */}
            {status === 'idle' && (
                <div style={{ marginBottom: 28 }}>
                    <p style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: 'var(--text-secondary)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        marginBottom: 12,
                    }}>
                        Export Format
                    </p>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: 10,
                    }}>
                        {FORMAT_OPTIONS.map((opt) => (
                            <button
                                key={opt.value}
                                onClick={() => setExportFormat(opt.value)}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: 6,
                                    padding: '14px 10px',
                                    borderRadius: 'var(--radius-sm)',
                                    border: exportFormat === opt.value
                                        ? '2px solid var(--accent)'
                                        : '2px solid var(--border)',
                                    background: exportFormat === opt.value
                                        ? 'rgba(99,102,241,0.12)'
                                        : 'var(--surface)',
                                    cursor: 'pointer',
                                    transition: 'all 0.18s ease',
                                    color: exportFormat === opt.value
                                        ? 'var(--accent)'
                                        : 'var(--text-secondary)',
                                }}
                            >
                                <span style={{ fontSize: 22 }}>{opt.icon}</span>
                                <span style={{
                                    fontWeight: 700,
                                    fontSize: 13,
                                    color: exportFormat === opt.value
                                        ? 'var(--accent)'
                                        : 'var(--text-primary)',
                                }}>
                                    {opt.label}
                                </span>
                                <span style={{ fontSize: 11, textAlign: 'center', lineHeight: 1.3 }}>
                                    {opt.desc}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Generate button */}
            {status === 'idle' && (
                <div style={{ textAlign: 'center', padding: '8px 0 32px' }}>
                    <div style={{
                        fontSize: 48,
                        marginBottom: 16,
                        opacity: 0.8,
                    }}>🎓</div>
                    <p style={{
                        fontSize: 14,
                        color: 'var(--text-secondary)',
                        marginBottom: 24,
                    }}>
                        {totalRows} certificate{totalRows !== 1 ? 's' : ''} will be generated using
                        your {Object.keys(mappings).length} field mapping{Object.keys(mappings).length !== 1 ? 's' : ''}.
                    </p>
                    <button className="btn btn-primary" onClick={handleGenerate} style={{ fontSize: 16, padding: '14px 40px' }}>
                        Generate All Certificates
                    </button>
                </div>
            )}

            {/* Progress */}
            {status === 'generating' && (
                <div className="progress-container">
                    <div className="progress-bar-bg">
                        <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="progress-text">
                        <span>{progress.current} of {progress.total}</span>
                        <span className="progress-name">{progress.name}</span>
                        <span>{pct}%</span>
                    </div>
                </div>
            )}

            {/* Done — download options */}
            {status === 'done' && result && (
                <>
                    {/* Warnings */}
                    {result.warnings?.length > 0 && (
                        <div style={{
                            padding: 12,
                            background: 'var(--warning-bg)',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid rgba(245, 158, 11, 0.3)',
                            marginBottom: 20,
                            fontSize: 13,
                            color: '#fcd34d',
                            maxHeight: 160,
                            overflowY: 'auto',
                        }}>
                            <strong>⚠ Warnings ({result.warnings.length})</strong>
                            <ul style={{ margin: '6px 0 0 16px', listStyle: 'disc' }}>
                                {result.warnings.slice(0, 10).map((w, i) => (
                                    <li key={i}>{w}</li>
                                ))}
                                {result.warnings.length > 10 && (
                                    <li>…and {result.warnings.length - 10} more</li>
                                )}
                            </ul>
                        </div>
                    )}

                    {/* Failures */}
                    {result.failures?.length > 0 && (
                        <div style={{
                            padding: 12,
                            background: 'var(--error-bg)',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            marginBottom: 20,
                            fontSize: 13,
                            color: '#fca5a5',
                        }}>
                            <strong>✕ {result.failures.length} certificate(s) failed</strong>
                            <ul style={{ margin: '6px 0 0 16px', listStyle: 'disc' }}>
                                {result.failures.slice(0, 5).map((f, i) => (
                                    <li key={i}>{f}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <div className="download-options">
                        {/* PDF ZIP */}
                        {result.download_zip && (
                            <a
                                href={result.download_zip}
                                className="download-card"
                                download
                            >
                                <div className="download-icon">📦</div>
                                <div className="download-label">Download ZIP</div>
                                <div className="download-desc">
                                    {result.count} individual PDF files
                                </div>
                            </a>
                        )}

                        {/* Merged PDF */}
                        {result.download_merged && (
                            <a
                                href={result.download_merged}
                                className="download-card"
                                download
                            >
                                <div className="download-icon">📑</div>
                                <div className="download-label">Download Merged PDF</div>
                                <div className="download-desc">
                                    All certificates in one file
                                </div>
                            </a>
                        )}

                        {/* PNG ZIP */}
                        {result.download_png_zip && (
                            <a
                                href={result.download_png_zip}
                                className="download-card"
                                download
                                style={{
                                    borderColor: 'rgba(16,185,129,0.4)',
                                    background: 'rgba(16,185,129,0.07)',
                                }}
                            >
                                <div className="download-icon">🖼️</div>
                                <div className="download-label" style={{ color: '#34d399' }}>
                                    Download PNGs
                                </div>
                                <div className="download-desc">
                                    {result.count} high-res PNG images
                                </div>
                            </a>
                        )}
                    </div>
                </>
            )}

            <div className="btn-row">
                <button
                    className="btn btn-ghost"
                    onClick={onBack}
                    disabled={status === 'generating'}
                >
                    ← Back
                </button>
                {status === 'done' && (
                    <button className="btn btn-secondary" onClick={() => { setStatus('idle'); setResult(null); }}>
                        ↻ Regenerate
                    </button>
                )}
            </div>
        </div>
    );
}
