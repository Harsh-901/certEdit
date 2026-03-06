"""Quick API test to verify the refactored backend endpoints."""
import requests

BASE = "http://localhost:5000"

# Step 1: Upload PDF
print("=== Upload PDF ===")
with open("test_certificate.pdf", "rb") as f:
    r = requests.post(f"{BASE}/api/upload-pdf", files={"file": f})

data = r.json()
print(f"Status: {r.status_code}")
print(f"Message: {data.get('message')}")
sid = data.get("session_id")
print(f"Session: {sid}")
print(f"Fields: {len(data.get('fields', []))}")

for f in data.get("fields", []):
    print(f"  {f['id']}: \"{f['text']}\" ({f['font']}, {f['size']}pt)")

fs = data.get("font_status", {})
print(f"All fonts available: {fs.get('all_available')}")

headers = {"X-Session-ID": sid}

# Step 2: Upload Data
print("\n=== Upload Data ===")
with open("test_data.csv", "rb") as f:
    r = requests.post(f"{BASE}/api/upload-data", files={"file": f}, headers=headers)

data = r.json()
print(f"Status: {r.status_code}")
print(f"Columns: {data.get('columns')}")
print(f"Total rows: {data.get('total_rows')}")

# Step 3: Preview with first field -> first column
fields = requests.post(f"{BASE}/api/upload-pdf", files={"file": open("test_certificate.pdf", "rb")}).json().get("fields", [])
cols = data.get("columns", [])

if fields and cols:
    mappings = {fields[0]["id"]: cols[0]}
    print(f"\n=== Preview (mapping: {mappings}) ===")
    
    # Re-upload data for the preview session
    new_sid = requests.post(f"{BASE}/api/upload-pdf", files={"file": open("test_certificate.pdf", "rb")}).json().get("session_id")
    with open("test_data.csv", "rb") as f:
        requests.post(f"{BASE}/api/upload-data", files={"file": f}, headers={"X-Session-ID": new_sid})
    
    r = requests.post(f"{BASE}/api/preview",
                       json={"mappings": mappings},
                       headers={"X-Session-ID": new_sid, "Content-Type": "application/json"})
    prev = r.json()
    print(f"Preview status: {prev.get('status')}")
    print(f"Preview message: {prev.get('message')}")
    if prev.get("pdf_base64"):
        print(f"Preview PDF size: {len(prev['pdf_base64'])} chars")

print("\nDone!")
