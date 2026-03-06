import React, { useState } from 'react';
import FileUpload from '../components/FileUpload';
import { uploadPdf } from '../api';

export default function UploadPdf({ onComplete, addToast }) {
    const [loading, setLoading] = useState(false);
    const [file, setFile] = useState(null);

    const handleFile = async (f) => {
        if (!f.name.toLowerCase().endsWith('.pdf')) {
            addToast('Please upload a PDF file.', 'error');
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
                Upload a vector PDF with real text layers. The system will detect every text field
                for you to map to your data.
            </p>

            <FileUpload
                accept=".pdf"
                label="Drop your certificate PDF here"
                hint="PDF with text layers · Vector format recommended"
                icon="📄"
                onFile={handleFile}
                hasFile={!!file}
                fileName={file?.name}
            />
        </div>
    );
}
