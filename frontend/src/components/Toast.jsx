import React from 'react';

export default function Toast({ toasts, onDismiss }) {
    if (!toasts.length) return null;

    return (
        <div className="toast-container">
            {toasts.map(t => (
                <div
                    key={t.id}
                    className={`toast ${t.type}`}
                    onClick={() => onDismiss(t.id)}
                >
                    <span>{t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : t.type === 'warning' ? '⚠' : 'ℹ'}</span>
                    {t.message}
                </div>
            ))}
        </div>
    );
}
