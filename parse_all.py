import json
import os
import csv
import parse_shrek

# Output directories (inside public/ for Vite to serve)
DATA_DIR = "public/data"
SCRIPTS_DIR = os.path.join(DATA_DIR, "scripts")
PACKS_DIR = os.path.join(DATA_DIR, "packs")

# Harry Potter CSV config
CSV_DIR = "hp-dataset/datasets"
HP_MOVIES = [
    {"file": "hp1.csv", "id": "hp-sorcerers-stone", "title": "Harry Potter and the Sorcerer's Stone", "year": 2001},
    {"file": "hp2.csv", "id": "hp-chamber-of-secrets", "title": "Harry Potter and the Chamber of Secrets", "year": 2002},
    {"file": "hp3.csv", "id": "hp-prisoner-of-azkaban", "title": "Harry Potter and the Prisoner of Azkaban", "year": 2004},
    {"file": "hp4.csv", "id": "hp-goblet-of-fire", "title": "Harry Potter and the Goblet of Fire", "year": 2005},
    {"file": "hp5.csv", "id": "hp-order-of-phoenix", "title": "Harry Potter and the Order of the Phoenix", "year": 2007},
    {"file": "hp6.csv", "id": "hp-half-blood-prince", "title": "Harry Potter and the Half-Blood Prince", "year": 2009},
    {"file": "hp7.csv", "id": "hp-deathly-hallows-1", "title": "Harry Potter and the Deathly Hallows Part 1", "year": 2010},
    {"file": "hp8.csv", "id": "hp-deathly-hallows-2", "title": "Harry Potter and the Deathly Hallows Part 2", "year": 2011},
]

# Shrek config
SHREK_MOVIES = [
    {"file": "shrek_1.txt", "id": "shrek-1", "title": "Shrek", "year": 2001, "type": "text_screenplay"},
    {"file": "shrek_2.pdf", "id": "shrek-2", "title": "Shrek 2", "year": 2004, "type": "pdf"},
    {"file": "shrek_3.txt", "id": "shrek-3", "title": "Shrek the Third", "year": 2007, "type": "text_screenplay"},
    {"file": "shrek_4.txt", "id": "shrek-4", "title": "Shrek Forever After", "year": 2010, "type": "text_transcript"},
]


def ensure_dirs():
    """Create output directories if they don't exist."""
    os.makedirs(SCRIPTS_DIR, exist_ok=True)
    os.makedirs(PACKS_DIR, exist_ok=True)


def parse_csv(filepath, movie_config):
    """Parse a Harry Potter CSV file and return script data."""
    if not os.path.exists(filepath):
        print(f"Skipping {movie_config['title']}: File {filepath} not found.")
        return None

    print(f"Parsing CSV: {movie_config['title']}...")
    lines = []

    with open(filepath, 'r', encoding='utf-8') as f:
        first_line = f.readline()
        f.seek(0)
        delimiter = ';' if ';' in first_line and ',' not in first_line else ','

        reader = csv.DictReader(f, delimiter=delimiter)
        for row in reader:
            char = row.get('character')
            text = row.get('dialog')
            if char and text:
                lines.append({
                    "character": char.upper().strip(),
                    "text": text.strip()
                })

    print(f"  Found {len(lines)} lines.")

    # Build characters list
    characters = sorted(set(line["character"] for line in lines))

    return {
        "id": movie_config["id"],
        "title": movie_config["title"],
        "year": movie_config["year"],
        "characters": characters,
        "lines": lines
    }


def parse_shrek_movie(movie_config):
    """Parse a Shrek movie file and return script data."""
    filepath = movie_config["file"]
    if not os.path.exists(filepath):
        print(f"Skipping {movie_config['title']}: File {filepath} not found.")
        return None

    ftype = movie_config["type"]

    if ftype.startswith("text"):
        mode = ftype.split("_")[1]
        raw_entries = parse_shrek.parse_shrek_text(filepath, movie_config["title"], mode)
    elif ftype == "pdf":
        raw_entries = parse_shrek.parse_shrek_pdf(filepath, movie_config["title"])
    else:
        print(f"Unknown type {ftype} for {movie_config['title']}")
        return None

    # Convert to new format
    lines = [{"character": e["character"], "text": e["text"]} for e in raw_entries]
    characters = sorted(set(line["character"] for line in lines))

    return {
        "id": movie_config["id"],
        "title": movie_config["title"],
        "year": movie_config["year"],
        "characters": characters,
        "lines": lines
    }


def write_script(script_data):
    """Write a script file to data/scripts/{id}.json"""
    if not script_data:
        return False
    if not script_data.get("lines"):
        print(f"  Skipping {script_data['id']}: No lines found")
        return False
    filepath = os.path.join(SCRIPTS_DIR, f"{script_data['id']}.json")
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(script_data, f, indent=2)
    print(f"  Wrote {filepath}")
    return True


def write_pack(pack_id, pack_name, pack_type, movie_ids, theme):
    """Write a pack file to data/packs/{id}.json"""
    pack_data = {
        "id": pack_id,
        "name": pack_name,
        "type": pack_type,
        "movies": movie_ids,
        "theme": theme
    }
    filepath = os.path.join(PACKS_DIR, f"{pack_id}.json")
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(pack_data, f, indent=2)
    print(f"Wrote pack: {filepath}")


def write_index(packs_info):
    """Write the main index file to data/index.json"""
    index_data = {
        "featured": [p["id"] for p in packs_info],
        "packs": packs_info
    }
    filepath = os.path.join(DATA_DIR, "index.json")
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(index_data, f, indent=2)
    print(f"Wrote index: {filepath}")


def main():
    ensure_dirs()

    # Track packs for index
    packs_info = []

    # --- Harry Potter ---
    hp_movie_ids = []
    hp_line_count = 0

    for movie_config in HP_MOVIES:
        filepath = os.path.join(CSV_DIR, movie_config["file"])
        script_data = parse_csv(filepath, movie_config)
        if script_data and write_script(script_data):
            hp_movie_ids.append(movie_config["id"])
            hp_line_count += len(script_data["lines"])

    if hp_movie_ids:
        write_pack(
            pack_id="harry-potter",
            pack_name="Harry Potter",
            pack_type="series",
            movie_ids=hp_movie_ids,
            theme={"primary": "#740001", "secondary": "#d3a625"}
        )
        packs_info.append({
            "id": "harry-potter",
            "name": "Harry Potter",
            "movieCount": len(hp_movie_ids)
        })

    print(f"Total HP lines: {hp_line_count}")

    # --- Shrek ---
    shrek_movie_ids = []
    shrek_line_count = 0

    for movie_config in SHREK_MOVIES:
        script_data = parse_shrek_movie(movie_config)
        if script_data and write_script(script_data):
            shrek_movie_ids.append(movie_config["id"])
            shrek_line_count += len(script_data["lines"])

    if shrek_movie_ids:
        write_pack(
            pack_id="shrek",
            pack_name="Shrek Series",
            pack_type="series",
            movie_ids=shrek_movie_ids,
            theme={"primary": "#4c6827", "secondary": "#8c5a2b"}
        )
        packs_info.append({
            "id": "shrek",
            "name": "Shrek Series",
            "movieCount": len(shrek_movie_ids)
        })

    print(f"Total Shrek lines: {shrek_line_count}")

    # --- Write Index ---
    write_index(packs_info)

    print("\nData generation complete!")
    print(f"Scripts: {SCRIPTS_DIR}/")
    print(f"Packs: {PACKS_DIR}/")
    print(f"Index: {DATA_DIR}/index.json")


if __name__ == "__main__":
    main()
