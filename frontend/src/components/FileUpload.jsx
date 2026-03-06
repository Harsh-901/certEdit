import React, { useRef, useState, useCallback } from 'react';

export default function FileUpload({ accept, label, hint, onFile, icon, hasFile, fileName }) {
    const inputRef = useRef(null);
    const [dragging, setDragging] = useState(false);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer?.files?.[0];
        if (file) onFile(file);
    }, [onFile]);

    const handleChange = useCallback((e) => {
        const file = e.target.files?.[0];
        if (file) onFile(file);
    }, [onFile]);

    return (
        <div
            className={`upload-zone${dragging ? ' dragging' : ''}${hasFile ? ' has-file' : ''}`}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
        >
            <div className="upload-icon">{hasFile ? '✓' : (icon || '↑')}</div>
            <div className="upload-label">
                {hasFile ? fileName : label || 'Drop file here or click to browse'}
            </div>
            <div className="upload-hint">
                {hasFile ? 'Click to replace' : (hint || '')}
            </div>
            <input
                ref={inputRef}
                type="file"
                accept={accept}
                onChange={handleChange}
                style={{ display: 'none' }}
            />
        </div>
    );
}
