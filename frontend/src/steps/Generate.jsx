import React, { useState, useCallback } from 'react';
import {
    generateCertificatesStream,
    generateCertificates,
    getDownloadUrl,
} from '../api';

export default function Generate({ mappings, nameColumn, totalRows, onBack, addToast }) {
    const [status, setStatus] = useState('idle'); // idle | generating | done | error
    const [progress, setProgress] = useState({ current: 0, total: 0, name: '' });
    const [result, setResult] = useState(null);

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
                generateCertificates(mappings, nameColumn).then((data) => {
                    if (data.status === 'success') {
                        setStatus('done');
                        setResult(data);
                        addToast(`${data.count} certificates ready.`, 'success');
                    }
                });
            },
        );
    }, [mappings, nameColumn, totalRows, addToast]);

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

            {/* Generate button */}
            {status === 'idle' && (
                <div style={{ textAlign: 'center', padding: '32px 0' }}>
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
                        <a
                            href={getDownloadUrl('zip')}
                            className="download-card"
                            download
                        >
                            <div className="download-icon">📦</div>
                            <div className="download-label">Download ZIP</div>
                            <div className="download-desc">
                                {result.count} individual PDF files
                            </div>
                        </a>

                        <a
                            href={getDownloadUrl('merged')}
                            className="download-card"
                            download
                        >
                            <div className="download-icon">📑</div>
                            <div className="download-label">Download Merged PDF</div>
                            <div className="download-desc">
                                All certificates in one file
                            </div>
                        </a>
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
