import React, { useState } from 'react';
import FileUpload from '../components/FileUpload';
import { uploadData } from '../api';

export default function UploadData({ onComplete, onBack, addToast }) {
    const [loading, setLoading] = useState(false);
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState(null);

    const handleFile = async (f) => {
        const ext = f.name.split('.').pop().toLowerCase();
        if (!['xlsx', 'csv', 'json'].includes(ext)) {
            addToast('Please upload an XLSX, CSV, or JSON file.', 'error');
            return;
        }

        setFile(f);
        setLoading(true);

        try {
            const data = await uploadData(f);
            if (data.status === 'error') {
                addToast(data.message, 'error');
                setLoading(false);
                return;
            }
            setPreview(data);
            onComplete(data);
        } catch (err) {
            addToast('Upload failed. Please try again.', 'error');
        }
        setLoading(false);
    };

    return (
        <div className="card" style={{ position: 'relative' }}>
            {loading && (
                <div className="loading-overlay">
                    <div className="spinner" />
                    <div className="loading-text">Parsing data file…</div>
                </div>
            )}

            <h2 className="card-title">Upload Recipient Data</h2>
            <p className="card-subtitle">
                Upload a spreadsheet or data file with one row per certificate recipient.
            </p>

            <FileUpload
                accept=".xlsx,.csv,.json"
                label="Drop your data file here"
                hint="XLSX · CSV · JSON"
                icon="📊"
                onFile={handleFile}
                hasFile={!!file}
                fileName={file?.name}
            />

            {preview && (
                <div style={{ marginTop: 24 }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
                        <span className="badge success">
                            {preview.total_rows} records
                        </span>
                        <span className="badge" style={{
                            background: 'rgba(108,99,255,.1)',
                            color: 'var(--accent-primary)',
                        }}>
                            {preview.columns.length} columns
                        </span>
                    </div>

                    <div className="data-table-wrapper">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    {preview.columns.map(col => (
                                        <th key={col}>{col}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {preview.preview.map((row, i) => (
                                    <tr key={i}>
                                        {preview.columns.map(col => (
                                            <td key={col}>{row[col] || '—'}</td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <div className="btn-row">
                <button className="btn btn-ghost" onClick={onBack}>← Back</button>
            </div>
        </div>
    );
}
