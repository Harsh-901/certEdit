import React, { useState, useCallback, useRef } from 'react';
import StepIndicator from './components/StepIndicator';
import Toast from './components/Toast';
import UploadPdf from './steps/UploadPdf';
import FontStatus from './steps/FontStatus';
import UploadData from './steps/UploadData';
import FieldMapping from './steps/FieldMapping';
import Preview from './steps/Preview';
import Generate from './steps/Generate';

const STEPS = [
    { num: 1, label: 'Upload PDF' },
    { num: 2, label: 'Fonts' },
    { num: 3, label: 'Data' },
    { num: 4, label: 'Mapping' },
    { num: 5, label: 'Preview' },
    { num: 6, label: 'Generate' },
];

export default function App() {
    const [step, setStep] = useState(1);
    const [toasts, setToasts] = useState([]);
    const toastId = useRef(0);

    // Shared pipeline state
    const [fields, setFields] = useState([]);
    const [pageWidth, setPageWidth] = useState(0);
    const [pageHeight, setPageHeight] = useState(0);
    const [fontStatus, setFontStatus] = useState(null);
    const [columns, setColumns] = useState([]);
    const [previewRows, setPreviewRows] = useState([]);
    const [totalRows, setTotalRows] = useState(0);
    const [mappings, setMappings] = useState({});
    const [nameColumn, setNameColumn] = useState(null);

    const addToast = useCallback((message, type = 'info') => {
        const id = ++toastId.current;
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 4500);
    }, []);

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const goNext = useCallback(() => setStep(s => Math.min(s + 1, 6)), []);
    const goBack = useCallback(() => setStep(s => Math.max(s - 1, 1)), []);

    // Auto-detect name column from headers
    const detectNameColumn = useCallback((cols) => {
        const hints = ['name', 'full name', 'fullname', 'recipient', 'participant'];
        const found = cols.find(c => hints.includes(c.toLowerCase().trim()));
        if (found) setNameColumn(found);
    }, []);

    const renderStep = () => {
        switch (step) {
            case 1:
                return (
                    <UploadPdf
                        onComplete={(data) => {
                            setFields(data.fields);
                            setPageWidth(data.page_width);
                            setPageHeight(data.page_height);
                            setFontStatus(data.font_status);
                            addToast(data.message, 'success');
                            // Skip font step if all fonts are available
                            if (data.font_status?.all_available) {
                                setStep(3);
                            } else {
                                goNext();
                            }
                        }}
                        addToast={addToast}
                    />
                );
            case 2:
                return (
                    <FontStatus
                        fontStatus={fontStatus}
                        onComplete={() => {
                            addToast('Fonts ready.', 'success');
                            goNext();
                        }}
                        onBack={goBack}
                        addToast={addToast}
                    />
                );
            case 3:
                return (
                    <UploadData
                        onComplete={(data) => {
                            setColumns(data.columns);
                            setPreviewRows(data.preview);
                            setTotalRows(data.total_rows);
                            detectNameColumn(data.columns);
                            addToast(data.message, 'success');
                            goNext();
                        }}
                        onBack={goBack}
                        addToast={addToast}
                    />
                );
            case 4:
                return (
                    <FieldMapping
                        fields={fields}
                        columns={columns}
                        previewRows={previewRows}
                        pageWidth={pageWidth}
                        pageHeight={pageHeight}
                        mappings={mappings}
                        setMappings={setMappings}
                        nameColumn={nameColumn}
                        setNameColumn={setNameColumn}
                        onComplete={() => {
                            addToast('Mappings saved.', 'success');
                            goNext();
                        }}
                        onBack={goBack}
                        addToast={addToast}
                    />
                );
            case 5:
                return (
                    <Preview
                        mappings={mappings}
                        onComplete={() => {
                            goNext();
                        }}
                        onBack={goBack}
                        addToast={addToast}
                    />
                );
            case 6:
                return (
                    <Generate
                        mappings={mappings}
                        nameColumn={nameColumn}
                        totalRows={totalRows}
                        onBack={goBack}
                        addToast={addToast}
                    />
                );
            default:
                return null;
        }
    };

    return (
        <>
            <header className="app-header">
                <div className="logo">
                    <div className="logo-icon">C</div>
                    <span className="logo-text">CertEdit</span>
                </div>
                <p className="header-tagline">Certificate Generation Pipeline</p>
            </header>

            <StepIndicator steps={STEPS} current={step} />

            <main className="app-main">
                {renderStep()}
            </main>

            <Toast toasts={toasts} onDismiss={removeToast} />
        </>
    );
}
