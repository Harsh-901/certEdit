"""
PDF text extraction and certificate generation service.
Uses PyMuPDF (fitz) for all PDF operations.

TRUE TEXT REPLACEMENT pipeline:
  1. DETECT — Extract bounding box, font, size, color, position via page.get_text("dict")
  2. REDACT — Use fitz redaction API to permanently remove original text from content stream
  3. REDRAW — Use page.insert_textbox to draw new text at exact same coordinates
"""

import fitz  # PyMuPDF
import os
import re


def _is_decorative(text):
    """Filter out single-character decorative/punctuation-only spans."""
    stripped = text.strip()
    if not stripped:
        return True
    # Single character that is a symbol or punctuation
    if len(stripped) == 1 and not stripped.isalnum():
        return True
    # All punctuation / symbols
    if all(not c.isalnum() and not c.isspace() for c in stripped):
        return True
    return False


def _color_int_to_rgb(color_int):
    """Convert PyMuPDF color integer to (r, g, b) tuple normalized 0-1."""
    r = ((color_int >> 16) & 0xFF) / 255.0
    g = ((color_int >> 8) & 0xFF) / 255.0
    b = (color_int & 0xFF) / 255.0
    return (r, g, b)


def _color_int_to_hex(color_int):
    """Convert PyMuPDF color integer to hex string."""
    return "#{:06x}".format(color_int)



def extract_text_fields(pdf_path):
    """
    Extract all text elements from a PDF with full metadata.
    Returns fields with id format 'field_0', 'field_1', etc.
    """
    try:
        doc = fitz.open(pdf_path)
    except Exception as e:
        msg = str(e).lower()
        if "password" in msg or "encrypted" in msg:
            return {"error": "This PDF is locked. Please upload an unlocked version."}
        if "cannot" in msg or "corrupt" in msg or "invalid" in msg:
            return {"error": "The PDF could not be read. Please try a different file."}
        return {"error": f"Could not open PDF: {str(e)}"}

    if doc.page_count == 0:
        return {"error": "This PDF has no pages."}

    fields = []
    field_index = 0

    for page_num in range(doc.page_count):
        page = doc[page_num]
        page_width = page.rect.width
        page_height = page.rect.height

        text_dict = page.get_text("dict", flags=fitz.TEXT_PRESERVE_WHITESPACE)

        for block_no, block in enumerate(text_dict.get("blocks", [])):
            if block.get("type") != 0:  # Only text blocks
                continue

            for line_no, line in enumerate(block.get("lines", [])):
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

                full_text = " ".join(line_text_parts)

                # Filter decorative text but keep placeholder-like text
                if _is_decorative(full_text):
                    continue

                primary_span = line_spans[0]
                bbox = list(line.get("bbox", primary_span.get("bbox", [0, 0, 0, 0])))
                origin = list(primary_span.get("origin", [bbox[0], bbox[3]]))

                # Detect alignment based on position relative to page width
                x_center = (bbox[0] + bbox[2]) / 2
                margin_threshold = page_width * 0.15

                if abs(x_center - page_width / 2) < margin_threshold:
                    alignment = 1  # center
                elif bbox[0] < margin_threshold:
                    alignment = 0  # left
                elif bbox[2] > page_width - margin_threshold:
                    alignment = 2  # right
                else:
                    alignment = 1  # default center for certificates

                # Convert color
                color_int = primary_span.get("color", 0)
                color_hex = _color_int_to_hex(color_int)
                color_rgb = _color_int_to_rgb(color_int)

                # Font flags
                flags = primary_span.get("flags", 0)
                is_bold = bool(flags & (1 << 4))
                is_italic = bool(flags & (1 << 1))

                field = {
                    "id": f"field_{field_index}",
                    "text": full_text,
                    "font": primary_span.get("font", "unknown"),
                    "size": round(primary_span.get("size", 12), 1),
                    "bbox": [round(b, 2) for b in bbox],
                    "origin": [round(o, 2) for o in origin],
                    "color": color_hex,
                    "color_rgb": list(color_rgb),
                    "align": alignment,
                    "is_bold": is_bold,
                    "is_italic": is_italic,
                    "page": page_num,
                    "block_no": block_no,
                    "line_no": line_no,
                }
                fields.append(field)
                field_index += 1

    total_pages = doc.page_count
    pw = round(doc[0].rect.width, 2) if total_pages > 0 else 0
    ph = round(doc[0].rect.height, 2) if total_pages > 0 else 0
    doc.close()

    if not fields:
        return {
            "error": "No text was detected. This may be an image-based PDF. "
                     "Please ensure your certificate has real text layers, not embedded images of text.",
        }

    return {
        "fields": fields,
        "page_count": total_pages,
        "page_width": pw,
        "page_height": ph,
    }


def generate_certificate(template_path, field_data, field_metadata, font_map, output_path=None):
    """
    Generate a single certificate by TRUE text replacement.

    Pipeline (batched for safety):
      1. Collect all fields to replace and sample bg colors BEFORE changes
      2. Add ALL redaction annotations at once
      3. Apply redactions ONCE (prevents destroying other text)
      4. Redraw ALL replacement text

    Args:
        template_path: Path to original PDF template
        field_data: dict of {field_id: new_text_value}
        field_metadata: dict of {field_id: field_metadata_dict}
        font_map: dict of {original_font_name: {"replacement": name, "path": path}}
        output_path: optional file path to save; if None, returns bytes

    Returns:
        PDF bytes if output_path is None, else saves to file and returns True.
    """
    doc = fitz.open(template_path)
    page = doc[0]

    # ── Phase 1: Prepare all fields and sample bg colors BEFORE any redaction ──
    redraw_tasks = []

    for field_id, new_value in field_data.items():
        meta = field_metadata.get(field_id)
        if meta is None:
            continue

        bbox = fitz.Rect(meta["bbox"])
        original_font = meta["font"]
        font_size = meta["size"]
        color_rgb = tuple(meta.get("color_rgb", [0, 0, 0]))
        alignment = meta.get("align", 1)

        original_text = meta.get("text", "")
        # If original text contains brackets, replace only the first bracketed portion
        if re.search(r'\[.*?\]|\{.*?\}', original_text):
            final_value = re.sub(r'\[.*?\]|\{.*?\}', str(new_value), original_text, count=1)
        else:
            final_value = str(new_value)

        # Resolve font
        font_path = None
        used_fontname = "helv"

        if original_font in font_map:
            fc = font_map[original_font]
            font_path = fc.get("path")

            if font_path and os.path.exists(font_path):
                try:
                    safe_id = field_id.replace("field_", "f")
                    page.insert_font(fontname=safe_id, fontfile=font_path)
                    used_fontname = safe_id
                except Exception:
                    used_fontname = "helv"
                    font_path = None

        redraw_tasks.append({
            "bbox": bbox,
            "new_value": final_value,
            "fontname": used_fontname,
            "font_path": font_path,
            "font_size": font_size,
            "color_rgb": color_rgb,
            "alignment": alignment,
        })

    # ── Phase 2: Add ALL redaction annotations ──
    for task in redraw_tasks:
        page.add_redact_annot(task["bbox"])

    # ── Phase 3: Apply ALL redactions in ONE pass ──
    if redraw_tasks:
        page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE)

    page_width = page.rect.width

    # ── Phase 4: Redraw ALL replacement text ──
    for task in redraw_tasks:
        text_rect = fitz.Rect(task["bbox"])
        
        # Expand rect vertically to ensure text is never clipped
        text_rect.y0 -= task["font_size"]
        text_rect.y1 += task["font_size"] * 2

        # Expand rect horizontally based on alignment to fit long text
        align = task["alignment"]
        if align == 0:  # Left aligned
            text_rect.x1 = page_width - 20
        elif align == 2:  # Right aligned
            text_rect.x0 = 20
        else:  # Center aligned
            center_x = (text_rect.x0 + text_rect.x1) / 2
            half_width = max(min(center_x - 20, page_width - 20 - center_x), 0)
            text_rect.x0 = center_x - half_width
            text_rect.x1 = center_x + half_width

        fp = task["font_path"]
        page.insert_textbox(
            text_rect,
            task["new_value"],
            fontname=task["fontname"],
            fontfile=fp if fp and os.path.exists(fp) else None,
            fontsize=task["font_size"],
            color=task["color_rgb"],
            align=align,
        )

    if output_path:
        doc.save(output_path)
        doc.close()
        return True
    else:
        pdf_bytes = doc.tobytes()
        doc.close()
        return pdf_bytes


def generate_bulk(template_path, mappings, all_rows, field_metadata, font_map,
                  name_column=None, output_dir="output", progress_callback=None):
    """
    Generate certificates for all data rows.

    Args:
        template_path: path to PDF template
        mappings: dict of {field_id: column_name}
        all_rows: list of row dicts
        field_metadata: dict of {field_id: metadata}
        font_map: font config
        name_column: column name to use for filenames
        output_dir: directory for output files
        progress_callback: callable(current, total, current_name) for SSE progress

    Returns dict with zip_path, merged_path, count, total, warnings, failures.
    """
    os.makedirs(output_dir, exist_ok=True)
    individual_dir = os.path.join(output_dir, "individual")
    os.makedirs(individual_dir, exist_ok=True)

    warnings = []
    failures = []
    generated_files = []
    name_counts = {}

    for row_idx, row_data in enumerate(all_rows):
        # Build field_data for this row
        field_data = {}
        for field_id, column_name in mappings.items():
            value = str(row_data.get(column_name, "")).strip()
            if not value:
                warnings.append(
                    f"Row {row_idx + 1}: '{column_name}' was empty. Field left blank."
                )
            field_data[field_id] = value

        # Determine filename
        current_name = ""
        if name_column and name_column in row_data:
            current_name = str(row_data[name_column]).strip()
            base_name = current_name.replace(" ", "_")
            base_name = re.sub(r"[^\w\-]", "", base_name)
        else:
            base_name = f"certificate_{row_idx + 1}"

        if not base_name:
            base_name = f"certificate_{row_idx + 1}"

        # Handle duplicates
        if base_name in name_counts:
            name_counts[base_name] += 1
            filename = f"{base_name}_{name_counts[base_name]}.pdf"
        else:
            name_counts[base_name] = 1
            filename = f"{base_name}.pdf"

        filepath = os.path.join(individual_dir, filename)

        # Report progress
        if progress_callback:
            progress_callback(row_idx + 1, len(all_rows), current_name or base_name)

        # Generate
        try:
            generate_certificate(
                template_path, field_data, field_metadata, font_map,
                output_path=filepath
            )
            generated_files.append(filepath)
        except Exception as e:
            failures.append(f"Row {row_idx + 1} ({current_name or base_name}): {str(e)}")
            continue

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
        "failures": failures,
    }
