"""
Font detection, availability checking, and suggestion engine.
Uses a curated library of Google Fonts with mood/style metadata.
Downloads and caches TTF files on demand.
"""

import os
import requests

FONTS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "fonts")
os.makedirs(FONTS_DIR, exist_ok=True)

# Curated font library with metadata for similarity matching
FONT_LIBRARY = {
    # Serif
    "Lora": {"category": "serif", "mood": "elegant", "style": "transitional", "weight": "regular"},
    "Playfair Display": {"category": "serif", "mood": "elegant", "style": "transitional", "weight": "bold"},
    "Merriweather": {"category": "serif", "mood": "formal", "style": "slab", "weight": "regular"},
    "EB Garamond": {"category": "serif", "mood": "classic", "style": "old-style", "weight": "regular"},
    "Cormorant Garamond": {"category": "serif", "mood": "elegant", "style": "old-style", "weight": "light"},
    "Libre Baskerville": {"category": "serif", "mood": "formal", "style": "transitional", "weight": "regular"},
    "Crimson Text": {"category": "serif", "mood": "classic", "style": "old-style", "weight": "regular"},

    # Sans-serif
    "Montserrat": {"category": "sans-serif", "mood": "modern", "style": "geometric", "weight": "regular"},
    "Inter": {"category": "sans-serif", "mood": "neutral", "style": "neo-grotesque", "weight": "regular"},
    "Raleway": {"category": "sans-serif", "mood": "elegant", "style": "geometric", "weight": "light"},
    "Nunito": {"category": "sans-serif", "mood": "friendly", "style": "rounded", "weight": "regular"},
    "Poppins": {"category": "sans-serif", "mood": "modern", "style": "geometric", "weight": "regular"},
    "Open Sans": {"category": "sans-serif", "mood": "neutral", "style": "humanist", "weight": "regular"},
    "Roboto": {"category": "sans-serif", "mood": "modern", "style": "neo-grotesque", "weight": "regular"},
    "Lato": {"category": "sans-serif", "mood": "neutral", "style": "humanist", "weight": "regular"},

    # Display / Decorative
    "Cinzel": {"category": "display", "mood": "formal", "style": "classical", "weight": "regular"},
    "Cinzel Decorative": {"category": "display", "mood": "formal", "style": "classical", "weight": "bold"},

    # Script / Calligraphy
    "Great Vibes": {"category": "script", "mood": "elegant", "style": "calligraphy", "weight": "regular"},
    "Dancing Script": {"category": "script", "mood": "playful", "style": "casual", "weight": "regular"},
    "Sacramento": {"category": "script", "mood": "elegant", "style": "calligraphy", "weight": "regular"},
    "Parisienne": {"category": "script", "mood": "elegant", "style": "formal-script", "weight": "regular"},
    "Pacifico": {"category": "script", "mood": "playful", "style": "casual", "weight": "regular"},

    # Monospace
    "Source Code Pro": {"category": "monospace", "mood": "technical", "style": "monospace", "weight": "regular"},
    "JetBrains Mono": {"category": "monospace", "mood": "technical", "style": "monospace", "weight": "regular"},
}

# Common font name normalization (PDF fonts often have variant suffixes)
FONT_NAME_ALIASES = {
    "arial": "Open Sans",
    "arialmt": "Open Sans",
    "arial-boldmt": "Open Sans",
    "helvetica": "Inter",
    "helvetica-bold": "Inter",
    "timesnewroman": "Libre Baskerville",
    "timesnewromanps": "Libre Baskerville",
    "times-roman": "Libre Baskerville",
    "calibri": "Lato",
    "cambria": "Merriweather",
    "georgia": "Merriweather",
    "verdana": "Nunito",
    "trebuchetms": "Montserrat",
    "palatino": "EB Garamond",
    "bookantiqua": "EB Garamond",
    "garamond": "EB Garamond",
    "century": "Libre Baskerville",
    "centurygothic": "Raleway",
    "futura": "Poppins",
    "avantgarde": "Montserrat",
    "copperplate": "Cinzel",
    "couriernew": "Source Code Pro",
    "courier": "Source Code Pro",
    "consolas": "JetBrains Mono",
}


def normalize_font_name(font_name):
    """Normalize a PDF font name by removing common suffixes and prefixes."""
    name = font_name.strip()
    # Remove common PDF font prefixes like "ABCDEF+"
    if "+" in name:
        name = name.split("+", 1)[1]
    # Remove style suffixes
    for suffix in ["-Regular", "-Bold", "-Italic", "-BoldItalic", ",Bold", ",Italic",
                   "-Light", "-Medium", "-SemiBold", "-ExtraBold", "-Black",
                   "MT", "PS", "PSMT"]:
        if name.endswith(suffix):
            name = name[:-len(suffix)]
    return name.strip()


def check_font_availability(font_name):
    """
    Check if a font is available. Returns dict with:
    - available: bool
    - matched_name: the library font name if found
    - is_alias: whether it was matched via alias
    """
    normalized = normalize_font_name(font_name)

    # Direct match in library
    for lib_name in FONT_LIBRARY:
        if lib_name.lower().replace(" ", "") == normalized.lower().replace(" ", "").replace("-", ""):
            return {"available": True, "matched_name": lib_name, "is_alias": False}

    # Alias match
    alias_key = normalized.lower().replace(" ", "").replace("-", "")
    if alias_key in FONT_NAME_ALIASES:
        return {"available": True, "matched_name": FONT_NAME_ALIASES[alias_key], "is_alias": True}

    return {"available": False, "matched_name": None, "is_alias": False}


def _compute_similarity(font_meta, target_meta):
    """Compute a similarity score between two font metadata dicts."""
    score = 0
    if font_meta["category"] == target_meta["category"]:
        score += 4
    if font_meta["mood"] == target_meta["mood"]:
        score += 3
    if font_meta["style"] == target_meta["style"]:
        score += 2
    if font_meta["weight"] == target_meta["weight"]:
        score += 1
    return score


def suggest_similar_fonts(font_name, count=3):
    """
    Suggest similar fonts from the library for a missing font.
    Returns list of dicts with name, reason.
    """
    normalized = normalize_font_name(font_name)

    # Try to guess the category/mood of the missing font from its name
    name_lower = normalized.lower()
    guessed_meta = {"category": "sans-serif", "mood": "neutral", "style": "neo-grotesque", "weight": "regular"}

    # Category guessing heuristics
    serif_hints = ["serif", "roman", "times", "garamond", "palatino", "baskerville", "book", "cambria", "georgia"]
    script_hints = ["script", "cursive", "calligraph", "handwrit", "brush", "vibes", "dancing"]
    display_hints = ["display", "decorat", "poster", "title", "cinzel", "trajan", "copperplate"]
    mono_hints = ["mono", "code", "courier", "consolas", "terminal"]

    if any(h in name_lower for h in serif_hints):
        guessed_meta["category"] = "serif"
        guessed_meta["mood"] = "formal"
        guessed_meta["style"] = "transitional"
    elif any(h in name_lower for h in script_hints):
        guessed_meta["category"] = "script"
        guessed_meta["mood"] = "elegant"
        guessed_meta["style"] = "calligraphy"
    elif any(h in name_lower for h in display_hints):
        guessed_meta["category"] = "display"
        guessed_meta["mood"] = "formal"
        guessed_meta["style"] = "classical"
    elif any(h in name_lower for h in mono_hints):
        guessed_meta["category"] = "monospace"
        guessed_meta["mood"] = "technical"
        guessed_meta["style"] = "monospace"

    # Bold hints
    if any(h in name_lower for h in ["bold", "black", "heavy"]):
        guessed_meta["weight"] = "bold"
    elif any(h in name_lower for h in ["light", "thin", "hairline"]):
        guessed_meta["weight"] = "light"

    # Formal/elegant hints
    if any(h in name_lower for h in ["formal", "classic", "old", "antique"]):
        guessed_meta["mood"] = "formal"
    elif any(h in name_lower for h in ["elegant", "grace"]):
        guessed_meta["mood"] = "elegant"

    # Score all library fonts
    scored = []
    for lib_name, lib_meta in FONT_LIBRARY.items():
        score = _compute_similarity(lib_meta, guessed_meta)
        scored.append((score, lib_name, lib_meta))

    scored.sort(key=lambda x: -x[0])

    # Build suggestions with reasons
    reasons_map = {
        "serif": "classic serif typeface",
        "sans-serif": "clean sans-serif",
        "script": "calligraphic/script style",
        "display": "display/decorative typeface",
        "monospace": "monospaced font",
    }

    suggestions = []
    for score, name, meta in scored[:count]:
        base = reasons_map.get(meta["category"], "similar typeface")
        mood_str = meta["mood"]
        reason = f"{name} — {mood_str} {base} with {meta['weight']} weight"
        suggestions.append({"name": name, "reason": reason})

    return suggestions


def get_font_path(font_name):
    """
    Get the local path to a font TTF file.
    Downloads from Google Fonts if not cached.
    Returns path or None if download fails.
    """
    # Check if already cached
    safe_name = font_name.replace(" ", "_")
    cached_path = os.path.join(FONTS_DIR, f"{safe_name}.ttf")
    if os.path.exists(cached_path):
        return cached_path

    # Try downloading from Google Fonts
    try:
        url = f"https://fonts.google.com/download?family={font_name.replace(' ', '+')}"
        # Google Fonts provides a ZIP file
        import zipfile
        import io

        response = requests.get(url, timeout=15)
        if response.status_code != 200:
            # Try the direct CSS API approach
            css_url = f"https://fonts.googleapis.com/css2?family={font_name.replace(' ', '+')}&display=swap"
            css_resp = requests.get(css_url, headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            }, timeout=10)
            if css_resp.status_code != 200:
                return None

            # Extract TTF/WOFF2 URL from CSS
            import re
            urls = re.findall(r'url\((https://fonts\.gstatic\.com/[^)]+)\)', css_resp.text)
            if not urls:
                return None

            # Download the font file
            font_resp = requests.get(urls[0], timeout=10)
            if font_resp.status_code == 200:
                ext = ".woff2" if "woff2" in urls[0] else ".ttf"
                final_path = os.path.join(FONTS_DIR, f"{safe_name}{ext}")
                with open(final_path, "wb") as f:
                    f.write(font_resp.content)
                return final_path
            return None

        # Handle ZIP download
        z = zipfile.ZipFile(io.BytesIO(response.content))
        # Find a regular/static TTF file
        ttf_files = [n for n in z.namelist() if n.endswith(".ttf")]
        # Prefer "Regular" or "static" variant
        target = None
        for tf in ttf_files:
            if "Regular" in tf or "static" in tf.lower():
                target = tf
                break
        if target is None and ttf_files:
            target = ttf_files[0]

        if target:
            with open(cached_path, "wb") as f:
                f.write(z.read(target))
            return cached_path

    except Exception as e:
        print(f"Font download failed for {font_name}: {e}")

    return None


def get_all_library_fonts():
    """Return the full font library for browsing."""
    result = []
    for name, meta in FONT_LIBRARY.items():
        result.append({
            "name": name,
            "category": meta["category"],
            "mood": meta["mood"],
            "style": meta["style"],
        })
    return result
