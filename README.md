# 📜 CertEdit — Certificate Generation System

<p align="center">
  <strong>Turn a blank certificate PDF into hundreds of personalized certificates — automatically.</strong>
</p>

<p align="center">
  Built for design leads, event organizers, educators, and anyone who needs to generate certificates at scale.
</p>

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 📄 **PDF Text Detection** | Automatically extracts all text fields from your certificate PDF — font, size, position, color, alignment |
| 🔤 **Smart Font Handling** | Auto-detects fonts, matches them to free alternatives, suggests 2-3 visually similar replacements for missing fonts |
| 📊 **Flexible Data Import** | Upload recipient data as XLSX, CSV, or JSON — auto-parses headers, previews rows, handles edge cases |
| 🔗 **Visual Column Mapping** | Two-panel interface to map data columns to certificate text fields with live validation |
| 👁️ **Live Preview** | Before/after toggle to compare your template vs. the filled certificate before bulk generation |
| 🚀 **Bulk Generation** | Generate hundreds of certificates in seconds with progress tracking |
| 📦 **Dual Export** | Download as individual PDFs in a ZIP, or as one merged multi-page PDF |
| ⚠️ **Smart Error Handling** | Human-readable error messages for password-protected PDFs, empty data, missing mappings, and more |

---

## 🖥️ Screenshots

The app features a dark-mode UI with glassmorphism cards, gradient accents, and a 6-step wizard:

**Step 1 — Upload Certificate Template**
> Drag-and-drop your PDF template. Text fields are auto-detected with font, size, color, and alignment metadata.

**Step 2 — Font Detection**
> Available fonts are loaded silently. Missing fonts get 2-3 similar suggestions with mood/style explanations.

**Step 3 — Data Upload**
> Drop your XLSX/CSV/JSON file. See headers, row count, and a preview of the first 3 rows instantly.

**Step 4 — Column Mapping**
> Two-panel interface: data columns on the left, certificate fields on the right. Connect them with dropdowns.

**Step 5 — Live Preview**
> Toggle between the original template and the filled certificate (using row 1 data) before committing.

**Step 6 — Bulk Generate**
> Progress bar, download as ZIP (individual PDFs) or merged PDF, warnings log.

---

## 🚀 Quick Start

### Prerequisites

- **Python 3.9+** (tested with 3.12)
- **Node.js 18+** (for the React frontend)

### Installation

```bash
# Clone or navigate to the project
cd H:\Projects\certEdit

# Install Python dependencies
cd backend
pip install -r requirements.txt

# Install Node dependencies
cd ../frontend
npm install
```

### Run

You need two terminal windows to run both the backend and frontend in development mode.

**Terminal 1 — Backend:**
```bash
cd backend
python app.py
```
*Backend runs on http://localhost:5000*

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```
*Frontend runs on http://localhost:3000*

Open **http://localhost:3000** in your browser.

---

## 📁 Project Structure

```
certEdit/
├── backend/
│   ├── app.py                      # Flask entry point (serves API + frontend)
│   ├── requirements.txt            # Python dependencies
│   ├── create_test_data.py         # Generate sample PDF + CSV for testing
│   ├── test_pipeline.py            # E2E API test script
│   │
│   ├── routes/
│   │   ├── pdf_routes.py           # /api/upload-template, /api/preview, /api/generate, /api/download
│   │   └── data_routes.py          # /api/upload-data, /api/validate-mapping, /api/font-library
│   │
│   ├── services/
│   │   ├── pdf_service.py          # PyMuPDF text extraction + certificate generation
│   │   ├── font_service.py         # Font library, similarity matching, Google Fonts download
│   │   ├── data_service.py         # XLSX/CSV/JSON parsing with edge case handling
│   │   └── session_store.py        # In-memory session management (TTL-based)
│   │
│   ├── uploads/                    # Uploaded files (auto-created)
│   ├── output/                     # Generated certificates (auto-created)
│   └── fonts/                      # Cached font files (auto-created)
│
└── frontend/
    ├── package.json                # Node dependencies & scripts
    ├── vite.config.js              # Vite configuration (proxy to 5000)
    ├── index.html                  # App entry point
    └── src/
        ├── main.jsx                # React root
        ├── App.jsx                 # Main application component
        ├── index.css               # Full design system (dark mode, glassmorphism)
        ├── api.js                  # Backend API wrapper with session management
        ├── components/             # Reusable UI components
        └── steps/                  # Wizard step components (upload, fonts, data, etc.)
```

---

## 🔧 API Reference

All endpoints return structured JSON. Include `X-Session-ID` header after the first upload.

### PDF Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/upload-template` | Upload PDF template, returns detected text fields + font status |
| `POST` | `/api/select-font` | Select a replacement font for a missing font |
| `POST` | `/api/preview` | Generate one certificate from row 1, returns base64 PDFs (filled + original) |
| `POST` | `/api/generate` | Bulk generate all certificates |
| `GET`  | `/api/download/<session_id>/zip` | Download individual PDFs as ZIP |
| `GET`  | `/api/download/<session_id>/merged` | Download merged multi-page PDF |

### Data Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/upload-data` | Upload XLSX/CSV/JSON, returns headers + preview + row count |
| `POST` | `/api/validate-mapping` | Validate column-to-field mappings, returns warnings |
| `GET`  | `/api/font-library` | Browse all available fonts in the library |
| `GET`  | `/api/health` | Health check |

### Example: Upload Template Response

```json
{
  "stage": "pdf_upload",
  "status": "success",
  "message": "Found 7 text fields across 1 page(s).",
  "session_id": "abc-123-def",
  "fields": [
    {
      "index": 0,
      "text": "Certificate of Achievement",
      "font": "Helvetica",
      "size": 32.0,
      "bbox": [120.5, 78.2, 721.5, 112.4],
      "origin": [421.0, 100.0],
      "color": "#33261a",
      "alignment": "center",
      "is_bold": false,
      "is_italic": false,
      "page": 0
    }
  ],
  "fonts": {
    "status": "ok",
    "message": "All fonts loaded. Ready to map your data.",
    "results": [
      { "detected": "Helvetica", "available": true, "matched_to": "Inter" }
    ]
  }
}
```

---

## 🔤 Font Library

CertEdit includes a curated library of **25 free Google Fonts** organized by category:

| Category | Fonts |
|----------|-------|
| **Serif** | Lora, Playfair Display, Merriweather, EB Garamond, Cormorant Garamond, Libre Baskerville, Crimson Text |
| **Sans-Serif** | Montserrat, Inter, Raleway, Nunito, Poppins, Open Sans, Roboto, Lato |
| **Display** | Cinzel, Cinzel Decorative |
| **Script** | Great Vibes, Dancing Script, Sacramento, Parisienne, Pacifico |
| **Monospace** | Source Code Pro, JetBrains Mono |

### Automatic Font Matching

Common PDF fonts are automatically mapped to their closest free equivalents:

| PDF Font | → Free Match |
|----------|-------------|
| Arial | Open Sans |
| Helvetica | Inter |
| Times New Roman | Libre Baskerville |
| Calibri | Lato |
| Cambria / Georgia | Merriweather |
| Garamond / Palatino | EB Garamond |
| Futura | Poppins |
| Courier New | Source Code Pro |
| Copperplate | Cinzel |

---

## ⚠️ Error Handling

CertEdit handles all expected failures with clear, user-friendly messages:

| Scenario | Message |
|----------|---------|
| Password-protected PDF | "This PDF is protected. Please upload an unlocked version." |
| Image-only PDF (no text layers) | "No editable text layers were found. This certificate may be image-based." |
| Empty data file | "Your data file appears to be empty. Please check and re-upload." |
| No mappings defined | "At least one mapping must be defined." |
| Unmapped name column | "It looks like you haven't mapped the 'Name' column. Are you sure?" |
| Blank value in mapped column | Logged as warning; field left blank on that certificate |
| Duplicate recipient names | Auto-appends number (e.g., `Aarav_Shah.pdf`, `Aarav_Shah_2.pdf`) |
| Font download failure | Falls back to closest system font, notifies user |

---

## 🧪 Testing

### Generate Sample Data

```bash
cd backend
python create_test_data.py
```

This creates:
- `test_certificate.pdf` — A4 landscape certificate with 7 text fields
- `test_data.csv` — 5 sample recipients with Name, Course, and Date columns

### Run E2E API Test

```bash
cd backend
python app.py          # Start the server (in one terminal)
python test_pipeline.py  # Run the test (in another terminal)
```

Tests all 6 pipeline stages: template upload → font detection → data parsing → mapping → preview → bulk generation.

---

## 🛠️ Tech Stack

| Component | Technology | Why |
|-----------|-----------|-----|
| Backend | Python 3 + Flask | Lightweight, pairs naturally with PyMuPDF |
| PDF Engine | PyMuPDF (fitz) | Best-in-class text extraction with full metadata (font, size, bbox, color, flags) + redact/reinsert for text replacement |
| Data Parsing | openpyxl, csv, json | Native Python libraries — no heavy dependencies |
| Font Source | Google Fonts | Free, high-quality, on-demand download + caching |
| Frontend | React 19 + Vite | Component-based, modern tooling, fast HMR |
| Styling | CSS Custom Properties | Dark mode, glassmorphism, gradient accents, micro-animations |

---

## 📋 Pipeline Stages

```
┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
│ 1. Upload│──▶│ 2. Fonts │──▶│ 3. Data  │──▶│ 4. Map   │──▶│ 5. Preview──▶│ 6. Export│
│    PDF   │   │ Detection│   │  Upload  │   │ Columns  │   │          │   │          │
└──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘
     │              │              │              │              │              │
  Extract        Match to       Parse          Map data      Generate      Bulk create
  text fields    free fonts     XLSX/CSV/JSON  → fields      1 preview     N certs
  with metadata  or suggest     + preview      + validate    before/after  ZIP + merged
```

---

## 📄 License

MIT — feel free to use, modify, and distribute.
