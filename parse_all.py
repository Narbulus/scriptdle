import pymupdf
import json
import re
import os
import csv

CONFIG_PDF = [
    {
        "file": "pulp_fiction.pdf",
        "title": "Pulp Fiction",
        "min_x": 168,
        "max_x": 172
    }
]

CSV_DIR = "hp-dataset/datasets"
CSV_MAPPING = {
    "hp1.csv": "Harry Potter and the Sorcerer's Stone",
    "hp2.csv": "Harry Potter and the Chamber of Secrets",
    "hp3.csv": "Harry Potter and the Prisoner of Azkaban",
    "hp4.csv": "Harry Potter and the Goblet of Fire",
    "hp5.csv": "Harry Potter and the Order of the Phoenix",
    "hp6.csv": "Harry Potter and the Half-Blood Prince",
    "hp7.csv": "Harry Potter and the Deathly Hallows Part 1",
    "hp8.csv": "Harry Potter and the Deathly Hallows Part 2"
}

def parse_pdf(config):
    path = config["file"]
    title = config["title"]
    min_x = config["min_x"]
    max_x = config["max_x"]

    if not os.path.exists(path):
        print(f"Skipping {title}: File {path} not found.")
        return []

    print(f"Parsing PDF {title}...")
    doc = pymupdf.open(path)
    entries = []

    for page in doc:
        blocks = page.get_text("blocks")
        blocks.sort(key=lambda b: b[1]) # Sort by y

        for b in blocks:
            x0 = b[0]
            text = b[4]

            if min_x <= x0 <= max_x:
                lines = text.strip().splitlines()
                if not lines:
                    continue

                character_raw = lines[0].strip()
                character_clean = re.sub(r'\s*\(.*?\)', '', character_raw).strip()

                if not character_clean.isupper() and len(character_clean) > 1:
                    continue

                dialogue_lines = lines[1:]
                if not dialogue_lines:
                    continue

                dialogue_text = "\n".join([l.strip() for l in dialogue_lines])

                entries.append({
                    "movie": title,
                    "character": character_clean,
                    "original_character": character_raw,
                    "text": dialogue_text
                })

    print(f"  Found {len(entries)} lines.")
    return entries

def parse_csv(filename, title):
    path = os.path.join(CSV_DIR, filename)
    if not os.path.exists(path):
        print(f"Skipping CSV {title}: File {path} not found.")
        return []

    print(f"Parsing CSV {title}...")
    entries = []
    with open(path, 'r', encoding='utf-8') as f:
        # Check delimiter. hp-dataset often uses ; or ,
        # Let's peek
        first_line = f.readline()
        f.seek(0)
        delimiter = ','
        if ';' in first_line and ',' not in first_line:
            delimiter = ';'

        reader = csv.DictReader(f, delimiter=delimiter)
        # Columns: character, dialog, etc.
        # Snippet said: character, dialog.
        # Let's verify headers.

        for row in reader:
            char = row.get('character')
            text = row.get('dialog')

            if char and text:
                entries.append({
                    "movie": title,
                    "character": char.upper().strip(),
                    "original_character": char,
                    "text": text.strip()
                })

    print(f"  Found {len(entries)} lines.")
    return entries

def main():
    all_data = []

    # PDF Parsing
    for c in CONFIG_PDF:
        all_data.extend(parse_pdf(c))

    # CSV Parsing
    for filename, title in CSV_MAPPING.items():
        all_data.extend(parse_csv(filename, title))

    print(f"Total lines: {len(all_data)}")

    with open("script.json", "w") as f:
        json.dump(all_data, f, indent=2)

if __name__ == "__main__":
    main()
