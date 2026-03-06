import React from 'react';

export default function StepIndicator({ steps, current }) {
    return (
        <nav className="step-indicator">
            {steps.map((s, i) => (
                <React.Fragment key={s.num}>
                    {i > 0 && (
                        <div className={`step-line${s.num <= current ? ' completed' : ''}`} />
                    )}
                    <div
                        className={`step-item${s.num === current ? ' active' : ''}${s.num < current ? ' completed' : ''}`}
                    >
                        <div className="step-circle">
                            {s.num < current ? '✓' : s.num}
                        </div>
                        <span className="step-label">{s.label}</span>
                    </div>
                </React.Fragment>
            ))}
        </nav>
    );
}
