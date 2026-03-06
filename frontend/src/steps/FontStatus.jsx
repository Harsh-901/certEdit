import React, { useState } from 'react';
import { selectFont } from '../api';

export default function FontStatus({ fontStatus, onComplete, onBack, addToast }) {
    const [replacements, setReplacements] = useState({});
    const [loading, setLoading] = useState({});

    if (!fontStatus) return null;

    const missingFonts = fontStatus.results?.filter(f => !f.available) || [];
    const availableFonts = fontStatus.results?.filter(f => f.available) || [];

    const allResolved = missingFonts.every(f => replacements[f.detected]);

    const handleSelect = async (originalFont, replacementFont) => {
        setLoading(prev => ({ ...prev, [originalFont]: true }));
        try {
            const res = await selectFont(originalFont, replacementFont);
            if (res.status === 'success') {
                setReplacements(prev => ({ ...prev, [originalFont]: replacementFont }));
                addToast(res.message, 'success');
            } else {
                addToast(res.message || 'Font selection failed.', 'error');
            }
        } catch {
            addToast('Font selection failed.', 'error');
        }
        setLoading(prev => ({ ...prev, [originalFont]: false }));
    };

    return (
        <div className="card">
            <h2 className="card-title">Font Status</h2>
            <p className="card-subtitle">
                {missingFonts.length === 0
                    ? 'All fonts are available. You can proceed.'
                    : `${missingFonts.length} font(s) need replacement. Select alternatives below.`}
            </p>

            {/* Available fonts */}
            {availableFonts.map(f => (
                <div key={f.detected} className="font-item available">
                    <div className="font-name">
                        {f.detected}
                        {f.is_alias && <span style={{ opacity: 0.5, marginLeft: 8, fontSize: 12 }}>→ {f.matched_to}</span>}
                    </div>
                    <div className="font-status-text">
                        <span className="badge success">✓ Available</span>
                    </div>
                </div>
            ))}

            {/* Missing fonts */}
            {missingFonts.map(f => (
                <div key={f.detected} className="font-item missing">
                    <div className="font-name">
                        {f.detected}
                        {replacements[f.detected] && (
                            <span style={{ color: 'var(--success)', marginLeft: 8, fontSize: 12 }}>
                                → {replacements[f.detected]}
                            </span>
                        )}
                    </div>
                    <div className="font-status-text">
                        {replacements[f.detected]
                            ? <span className="badge success">✓ Replaced</span>
                            : <span className="badge warning">⚠ Not found — select a replacement</span>
                        }
                    </div>
                    {f.suggestions && !replacements[f.detected] && (
                        <div className="font-suggestions">
                            {f.suggestions.map(s => (
                                <button
                                    key={s.name}
                                    className={`font-suggestion-btn${replacements[f.detected] === s.name ? ' selected' : ''}`}
                                    onClick={() => handleSelect(f.detected, s.name)}
                                    disabled={loading[f.detected]}
                                    title={s.reason}
                                >
                                    {loading[f.detected] ? '…' : s.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            ))}

            <div className="btn-row">
                <button className="btn btn-ghost" onClick={onBack}>← Back</button>
                <button
                    className="btn btn-primary"
                    onClick={onComplete}
                    disabled={!allResolved && missingFonts.length > 0}
                >
                    Continue →
                </button>
            </div>
        </div>
    );
}
