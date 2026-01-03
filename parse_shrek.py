import re
import json
import sys
import html

try:
    import pymupdf
    HAS_PYMUPDF = True
except ImportError:
    HAS_PYMUPDF = False
    print("Warning: pymupdf not installed. PDF parsing will be skipped.")

def parse_shrek_text(filepath, movie_title, mode="screenplay"):
    print(f"Parsing text script for {movie_title} (Mode: {mode})...")
    script_data = []

    with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
        lines = f.readlines()

    current_char = None
    current_dialogue = []

    if mode == "transcript":
        for line in lines:
            line = line.strip()
            if not line: continue

            # Remove HTML entities
            line = html.unescape(line)

            match = re.match(r'^([A-Z0-9 ]+): (.*)', line)
            if match:
                char = match.group(1).strip()
                text = match.group(2).strip()

                if char in ["SCENE", "INT", "EXT"]: continue
                # Skip if char contains lower case (unless regex prevents it)
                if not char.isupper(): continue

                script_data.append({
                    "movie": movie_title,
                    "character": char,
                    "text": text
                })
    else: # screenplay
        for line in lines:
            stripped = line.strip()
            if not stripped:
                continue

            # Check indentation
            indent = len(line) - len(line.lstrip())

            # Relaxed Character detection: > 20 spaces
            if indent > 20 and stripped.isupper() and not " - " in stripped and len(stripped) < 50:
                 if current_char and current_dialogue:
                     full_text = " ".join(current_dialogue)
                     script_data.append({
                         "movie": movie_title,
                         "character": current_char,
                         "text": full_text
                     })
                     current_dialogue = []

                 current_char = re.sub(r'\s*\(.*\)', '', stripped).strip()

            elif indent > 10 and indent < 35:
                 if stripped.startswith('(') and stripped.endswith(')'):
                     continue

                 if current_char:
                     current_dialogue.append(stripped)

        # Flush last
        if current_char and current_dialogue:
            full_text = " ".join(current_dialogue)
            script_data.append({
                "movie": movie_title,
                "character": current_char,
                "text": full_text
            })

    print(f"  Found {len(script_data)} lines.")
    return script_data

def parse_shrek_pdf(filepath, movie_title):
    if not HAS_PYMUPDF:
        print(f"Skipping PDF {movie_title}: pymupdf not installed.")
        return []

    print(f"Parsing PDF script for {movie_title}...")
    doc = pymupdf.open(filepath)
    entries = []

    for page in doc:
        blocks = page.get_text("blocks")
        blocks.sort(key=lambda b: b[1]) # Sort by y

        for b in blocks:
            x0 = b[0]
            text = b[4].strip()
            if not text: continue

            lines = text.splitlines()
            head = lines[0].strip()
            head_clean = re.sub(r'\s*\(.*?\)', '', head).strip()

            # Simple heuristic for PDF block structure
            if head_clean.isupper() and len(head_clean) > 0 and len(head_clean) < 40 and not "EXT." in head and not "INT." in head:
                 dialogue_lines = lines[1:]
                 if dialogue_lines:
                     dialogue_text = " ".join([l.strip() for l in dialogue_lines])
                     if not dialogue_text.startswith('('):
                         entries.append({
                             "movie": movie_title,
                             "character": head_clean,
                             "text": dialogue_text
                         })

    print(f"  Found {len(entries)} lines.")
    return entries
