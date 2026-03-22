import React, { useState } from 'react';
import FileUpload from '../components/FileUpload';
import { uploadPdf } from '../api';

export default function UploadPdf({ onComplete, addToast }) {
    const [loading, setLoading] = useState(false);
    const [file, setFile] = useState(null);

    const handleFile = async (f) => {
        const fileName = f.name.toLowerCase();
        if (!fileName.endsWith('.pdf') && !fileName.endsWith('.svg')) {
            addToast('Please upload a PDF or SVG file.', 'error');
            return;
        }

        setFile(f);
        setLoading(true);

        try {
            const data = await uploadPdf(f);
            if (data.status === 'error') {
                addToast(data.message, 'error');
                setLoading(false);
                return;
            }
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
                    <div className="loading-text">Analyzing certificate template…</div>
                </div>
            )}

            <h2 className="card-title">Upload Certificate Template</h2>
            <p className="card-subtitle">
                Upload a vector PDF or SVG with real text layers. The system will detect every text field
                for you to map to your data.
            </p>

            <FileUpload
                accept=".pdf,.svg"
                label="Drop your certificate PDF/SVG here"
                hint="PDF or SVG with text layers · Vector format recommended"
                icon="📄"
                onFile={handleFile}
                hasFile={!!file}
                fileName={file?.name}
            />
        </div>
    );
}
