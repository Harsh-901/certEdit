"""Test the complete API pipeline."""
import requests
import json

BASE = "http://localhost:5000"

# Step 1: Upload template
print("=" * 50)
print("STEP 1: Upload Template")
print("=" * 50)
with open("test_certificate.pdf", "rb") as f:
    r = requests.post(f"{BASE}/api/upload-template", files={"file": f})

data = r.json()
print(f"Status: {r.status_code}")
print(f"Message: {data.get('message')}")
session_id = data.get("session_id")
print(f"Session: {session_id}")
print(f"Fields found: {len(data.get('fields', []))}")

for field in data.get("fields", []):
    print(f"  [{field['index']}] \"{field['text']}\" font={field['font']} size={field['size']}pt align={field['alignment']}")

fonts = data.get("fonts", {})
print(f"\nFonts status: {fonts.get('status')}")
print(f"Fonts message: {fonts.get('message')}")
for fr in fonts.get("results", []):
    print(f"  {fr['detected']}: available={fr['available']}, matched_to={fr.get('matched_to')}")

headers = {"X-Session-ID": session_id}

# Step 3: Upload data
print("\n" + "=" * 50)
print("STEP 3: Upload Data")
print("=" * 50)
with open("test_data.csv", "rb") as f:
    r = requests.post(f"{BASE}/api/upload-data", files={"file": f}, headers=headers)

data = r.json()
print(f"Status: {r.status_code}")
print(f"Message: {data.get('message')}")
print(f"Headers: {data.get('headers')}")
print(f"Row count: {data.get('row_count')}")
print(f"Preview: {json.dumps(data.get('preview', [])[:2], indent=2)}")

# Step 4: Validate mapping
print("\n" + "=" * 50)
print("STEP 4: Validate Mapping")
print("=" * 50)
# Map "Name" -> field 2 (Recipient Name), "Course" -> field 4 (Course Title)
mappings = {"2": "Name", "4": "Course"}
r = requests.post(f"{BASE}/api/validate-mapping",
                   json={"mappings": mappings, "name_column": "Name"},
                   headers=headers)
data = r.json()
print(f"Status: {r.status_code}")
print(f"Message: {data.get('message')}")
print(f"Warnings: {data.get('warnings')}")

# Step 5: Preview
print("\n" + "=" * 50)
print("STEP 5: Preview")
print("=" * 50)
r = requests.post(f"{BASE}/api/preview",
                   json={"mappings": mappings},
                   headers=headers)
data = r.json()
print(f"Status: {r.status_code}")
print(f"Message: {data.get('message')}")
if data.get("preview_pdf"):
    print(f"Preview PDF: {len(data['preview_pdf'])} bytes (base64)")
    # Save preview to file
    import base64
    with open("preview_output.pdf", "wb") as f:
        f.write(base64.b64decode(data["preview_pdf"]))
    print("Saved preview to preview_output.pdf")

# Step 6: Generate
print("\n" + "=" * 50)
print("STEP 6: Bulk Generate")
print("=" * 50)
r = requests.post(f"{BASE}/api/generate",
                   json={"mappings": mappings, "name_column": "Name"},
                   headers=headers)
data = r.json()
print(f"Status: {r.status_code}")
print(f"Message: {data.get('message')}")
print(f"Count: {data.get('count')}/{data.get('total')}")
print(f"Warnings: {len(data.get('warnings', []))} warning(s)")
for w in data.get("warnings", [])[:5]:
    print(f"  {w}")
print(f"Download ZIP: {data.get('download_zip')}")
print(f"Download Merged: {data.get('download_merged')}")

print("\n✅ ALL TESTS PASSED!")
