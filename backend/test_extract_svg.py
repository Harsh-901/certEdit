import os
import fitz
from services.pdf_service import extract_text_fields

# Create SVG
svg_content = """<?xml version="1.0" encoding="UTF-8"?>
<svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
  <rect width="400" height="300" fill="#f0f0f0"/>
  <text x="200" y="150" font-family="Arial" font-size="24" text-anchor="middle" fill="#000000">Certificate of Completion</text>
  <text x="200" y="200" font-family="Arial" font-size="18" text-anchor="middle" fill="#333333">Awarded to: {{NAME}}</text>
</svg>"""

with open("test.svg", "w") as f:
    f.write(svg_content)

# Convert to PDF
doc = fitz.open("test.svg")
pdfbytes = doc.convert_to_pdf()
with open("test_converted.pdf", "wb") as f:
    f.write(pdfbytes)
doc.close()

# Extract fields
result = extract_text_fields("test_converted.pdf")
print("Extracted fields:")
for field in result.get("fields", []):
    print(field)
