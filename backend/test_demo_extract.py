import fitz, json
from services.pdf_service import extract_text_fields

doc = fitz.open(r"..\demo_certificate.svg")
pdfbytes = doc.convert_to_pdf()
with open("test_demo.pdf", "wb") as f:
    f.write(pdfbytes)

res = extract_text_fields("test_demo.pdf")
print("EXTRACTED TEXTS:")
for f in res.get("fields", []):
    print("- " + f["text"])
