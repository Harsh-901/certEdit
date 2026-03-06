"""
PDF text extraction and certificate generation service.
Uses PyMuPDF (fitz) for all PDF operations.
"""

import fitz  # PyMuPDF
import os
import copy


def extract_text_fields(pdf_path):
    """
    Extract all text elements from a PDF with full metadata.
    Returns a list of field dicts with text, font, size, position, color, alignment.
    """
    try:
        doc = fitz.open(pdf_path)
    except Exception as e:
        if "password" in str(e).lower() or "encrypted" in str(e).lower():
            return {"error": "This PDF is protected. Please upload an unlocked version."}
        return {"error": f"Could not open PDF: {str(e)}"}

    if doc.page_count == 0:
        return {"error": "This PDF has no pages."}

    fields = []
    field_index = 0

    for page_num in range(doc.page_count):
        page = doc[page_num]
        page_width = page.rect.width
        page_height = page.rect.height

        # Get text with full detail
        text_dict = page.get_text("dict", flags=fitz.TEXT_PRESERVE_WHITESPACE)

        for block in text_dict.get("blocks", []):
            if block.get("type") != 0:  # Only text blocks
                continue

            for line in block.get("lines", []):
                line_text_parts = []
                line_spans = []

                for span in line.get("spans", []):
                    text = span.get("text", "").strip()
                    if not text:
                        continue

                    line_text_parts.append(text)
                    line_spans.append(span)

                if not line_spans:
                    continue

                # Use the first span's properties as the line's properties
                # (most certificates have uniform styling per line)
                primary_span = line_spans[0]
                full_text = " ".join(line_text_parts)

                # Calculate bounding box for the entire line
                bbox = list(line.get("bbox", primary_span.get("bbox", [0, 0, 0, 0])))
                origin = list(primary_span.get("origin", [bbox[0], bbox[3]]))

                # Detect alignment based on x position relative to page width
                x_center = (bbox[0] + bbox[2]) / 2
                margin_threshold = page_width * 0.15

                if abs(x_center - page_width / 2) < margin_threshold:
                    alignment = "center"
                elif bbox[0] < margin_threshold:
                    alignment = "left"
                elif bbox[2] > page_width - margin_threshold:
                    alignment = "right"
                else:
                    alignment = "center"  # Default to center for certificates

                # Convert color int to hex
                color_int = primary_span.get("color", 0)
                color_hex = "#{:06x}".format(color_int)

                # Font flags
                flags = primary_span.get("flags", 0)
                is_bold = bool(flags & 2**4)  # bit 4
                is_italic = bool(flags & 2**1)  # bit 1

                field = {
                    "index": field_index,
                    "text": full_text,
                    "font": primary_span.get("font", "unknown"),
                    "size": round(primary_span.get("size", 12), 1),
                    "bbox": [round(b, 2) for b in bbox],
                    "origin": [round(o, 2) for o in origin],
                    "color": color_hex,
                    "alignment": alignment,
                    "is_bold": is_bold,
                    "is_italic": is_italic,
                    "page": page_num,
                    "page_width": round(page_width, 2),
                    "page_height": round(page_height, 2),
                    # Store all spans for accurate replacement
                    "_spans": line_spans,
                }
                fields.append(field)
                field_index += 1

    total_pages = doc.page_count
    first_page_width = round(doc[0].rect.width, 2) if total_pages > 0 else 0
    first_page_height = round(doc[0].rect.height, 2) if total_pages > 0 else 0
    doc.close()

    if not fields:
        return {
            "error": "No editable text layers were found. This certificate may be image-based. Please upload a PDF with text layers.",
        }

    return {
        "fields": fields,
        "page_count": total_pages,
        "page_width": first_page_width,
        "page_height": first_page_height,
    }


def generate_certificate(template_path, field_mappings, row_data, fonts_config):
    """
    Generate a single certificate by replacing mapped text fields.

    Args:
        template_path: Path to original PDF template
        field_mappings: dict of {field_index: column_name}
        row_data: dict of {column_name: value} for this row
        fonts_config: dict of {original_font_name: {"replacement": font_name, "path": font_path}}

    Returns:
        PDF bytes of the generated certificate
    """
    doc = fitz.open(template_path)

    # Re-extract fields to get span info
    extraction = extract_text_fields(template_path)
    if "error" in extraction:
        return None

    fields = extraction["fields"]

    for field_idx_str, column_name in field_mappings.items():
        field_idx = int(field_idx_str)
        new_value = str(row_data.get(column_name, ""))

        # Find the field
        field = None
        for f in fields:
            if f["index"] == field_idx:
                field = f
                break

        if field is None:
            continue

        page = doc[field["page"]]
        bbox = fitz.Rect(field["bbox"])

        # Determine font to use
        original_font = field["font"]
        font_path = None
        font_name = None

        if original_font in fonts_config:
            fc = fonts_config[original_font]
            font_path = fc.get("path")
            font_name = fc.get("replacement", original_font)

        # Redact the original text
        page.add_redact_annot(bbox, text="", fill=(1, 1, 1))  # White fill to erase
        page.apply_redactions()

        # Insert new text at the original position
        font_size = field["size"]
        color_hex = field["color"].lstrip("#")
        r = int(color_hex[0:2], 16) / 255
        g = int(color_hex[2:4], 16) / 255
        b = int(color_hex[4:6], 16) / 255

        # Calculate insertion point based on alignment
        origin_x = field["origin"][0]
        origin_y = field["origin"][1]

        # Load custom font if available
        if font_path and os.path.exists(font_path):
            try:
                page.insert_font(fontname="custom_font", fontfile=font_path)
                used_fontname = "custom_font"
            except Exception:
                used_fontname = "helv"  # Fallback to Helvetica
        else:
            used_fontname = "helv"

        # Handle alignment
        if field["alignment"] == "center":
            text_width = fitz.get_text_length(new_value, fontname=used_fontname, fontsize=font_size)
            insert_x = (bbox.x0 + bbox.x1) / 2 - text_width / 2

            # Also try page-center approach
            page_center_x = field["page_width"] / 2
            orig_text_width = fitz.get_text_length(field["text"], fontname=used_fontname, fontsize=font_size)
            orig_center = field["origin"][0] + orig_text_width / 2

            if abs(orig_center - page_center_x) < field["page_width"] * 0.15:
                insert_x = page_center_x - text_width / 2
        elif field["alignment"] == "right":
            text_width = fitz.get_text_length(new_value, fontname=used_fontname, fontsize=font_size)
            insert_x = bbox.x1 - text_width
        else:
            insert_x = origin_x

        # Clamp x to valid range
        insert_x = max(0, insert_x)

        page.insert_text(
            point=(insert_x, origin_y),
            text=new_value,
            fontname=used_fontname,
            fontfile=font_path if font_path and os.path.exists(font_path) else None,
            fontsize=font_size,
            color=(r, g, b),
        )

    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


def generate_bulk(template_path, field_mappings, all_rows, fonts_config, name_column=None, output_dir="output"):
    """
    Generate certificates for all data rows.

    Returns dict with:
        - zip_path: path to ZIP file with individual PDFs
        - merged_path: path to merged multi-page PDF
        - count: number of certificates generated
        - warnings: list of warning messages
    """
    os.makedirs(output_dir, exist_ok=True)
    individual_dir = os.path.join(output_dir, "individual")
    os.makedirs(individual_dir, exist_ok=True)

    warnings = []
    generated_files = []
    name_counts = {}

    for row_idx, row_data in enumerate(all_rows):
        # Check for blank mapped values
        for field_idx_str, column_name in field_mappings.items():
            value = row_data.get(column_name, "")
            if value is None or str(value).strip() == "":
                warnings.append(f"Warning: {column_name} was empty for row {row_idx + 1}. That field was left blank.")

        # Generate the certificate
        pdf_bytes = generate_certificate(template_path, field_mappings, row_data, fonts_config)
        if pdf_bytes is None:
            warnings.append(f"Failed to generate certificate for row {row_idx + 1}.")
            continue

        # Determine filename
        if name_column and name_column in row_data:
            base_name = str(row_data[name_column]).strip().replace(" ", "_")
            base_name = "".join(c for c in base_name if c.isalnum() or c == "_")
        else:
            base_name = f"certificate_{row_idx + 1}"

        if not base_name:
            base_name = f"certificate_{row_idx + 1}"

        # Handle duplicate names
        if base_name in name_counts:
            name_counts[base_name] += 1
            filename = f"{base_name}_{name_counts[base_name]}.pdf"
        else:
            name_counts[base_name] = 1
            filename = f"{base_name}.pdf"

        filepath = os.path.join(individual_dir, filename)
        with open(filepath, "wb") as f:
            f.write(pdf_bytes)
        generated_files.append(filepath)

    # Create ZIP
    import zipfile
    zip_path = os.path.join(output_dir, "certificates.zip")
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for fp in generated_files:
            zf.write(fp, os.path.basename(fp))

    # Create merged PDF
    merged_path = os.path.join(output_dir, "certificates_merged.pdf")
    if generated_files:
        merged_doc = fitz.open()
        for fp in generated_files:
            cert_doc = fitz.open(fp)
            merged_doc.insert_pdf(cert_doc)
            cert_doc.close()
        merged_doc.save(merged_path)
        merged_doc.close()

    return {
        "zip_path": zip_path,
        "merged_path": merged_path,
        "count": len(generated_files),
        "total": len(all_rows),
        "warnings": warnings,
    }
