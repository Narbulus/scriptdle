import json
import os
import re
from pypdf import PdfReader
from bs4 import BeautifulSoup

def clean_text(text):
    return re.sub(r'\s+', ' ', text).strip()

def is_all_caps(text):
    return text.isupper() and len(text) > 1

def parse_pdf_screenplay(filepath, movie_title):
    try:
        reader = PdfReader(filepath)
    except Exception as e:
        print(f"Error reading PDF {filepath}: {e}")
        return []

    dialogue = []
    current_character = None
    current_text = []

    for page in reader.pages:
        try:
            text = page.extract_text(layout_mode_space_vertically=False)
        except:
            continue

        lines = text.split('\n')

        for line in lines:
            line = line.rstrip()
            stripped = line.strip()
            if not stripped:
                continue

            if stripped.startswith(('INT.', 'EXT.', 'CUT TO:', 'FADE IN:', 'DISSOLVE TO:')):
                current_character = None
                continue

            if is_all_caps(stripped) and len(stripped) < 30 and not stripped.endswith('.'):
                if current_character and current_text:
                    dialogue.append({"movie": movie_title, "character": current_character, "text": " ".join(current_text)})
                    current_text = []
                current_character = stripped
            elif current_character:
                if stripped.startswith('(') and stripped.endswith(')'):
                    continue
                current_text.append(stripped)

    if current_character and current_text:
        dialogue.append({"movie": movie_title, "character": current_character, "text": " ".join(current_text)})

    return dialogue

def parse_imsdb_html(filepath, movie_title):
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        soup = BeautifulSoup(f, 'html.parser')

    dialogue = []
    pre = soup.find('pre')
    if not pre:
        text = soup.get_text()
    else:
        text = pre.get_text()

    lines = text.split('\n')
    current_character = None
    current_text = []

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue

        indent = len(line) - len(line.lstrip())

        if indent > 15 and is_all_caps(stripped) and len(stripped) < 30:
            if current_character and current_text:
                dialogue.append({"movie": movie_title, "character": current_character, "text": " ".join(current_text)})
                current_text = []
            current_character = stripped
        elif current_character and indent > 5:
             if stripped.startswith('('):
                 continue
             current_text.append(stripped)
        elif indent == 0:
             if current_character:
                 if current_text:
                     dialogue.append({"movie": movie_title, "character": current_character, "text": " ".join(current_text)})
                     current_text = []
                 current_character = None

    if current_character and current_text:
        dialogue.append({"movie": movie_title, "character": current_character, "text": " ".join(current_text)})

    return dialogue

def parse_totoro(filepath):
    dialogue = []
    with open(filepath, 'r', encoding='utf-8-sig', errors='ignore') as f:
        for line in f:
            stripped = line.strip()
            if ':' in stripped:
                parts = stripped.split(':', 1)
                char = parts[0].strip().upper()
                text = parts[1].strip()
                if char and text and len(char) < 20:
                    dialogue.append({"movie": "My Neighbor Totoro", "character": char, "text": text})
    return dialogue

def parse_fellowship_transcript(filepath):
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        soup = BeautifulSoup(f, 'html.parser')
    text = soup.get_text()
    dialogue = []

    lines = text.split('\n')
    for line in lines:
        if ':' in line:
            parts = line.split(':', 1)
            char = parts[0].strip().upper()
            txt = parts[1].strip().strip('"')
            if len(char) < 20 and " " not in char:
                 dialogue.append({"movie": "The Fellowship of the Ring", "character": char, "text": txt})
            elif char in ["GANDALF", "FRODO", "SAM", "MERRY", "PIPPIN", "ARAGORN", "LEGOLAS", "GIMLI", "BOROMIR", "ELROND", "GALADRIEL", "SARUMAN", "BILBO"]:
                 dialogue.append({"movie": "The Fellowship of the Ring", "character": char, "text": txt})
    return dialogue

def main():
    new_data = {}

    # Comedies
    comedies_dir = 'scripts/comedies'
    new_data["Early 2000s Comedies"] = []
    if os.path.exists(comedies_dir):
        for filename in os.listdir(comedies_dir):
            if filename.endswith('.pdf'):
                path = os.path.join(comedies_dir, filename)
                print(f"Parsing {filename}...")
                title = filename.replace('.pdf', '').replace('_', ' ').title()
                script = parse_pdf_screenplay(path, title)
                new_data["Early 2000s Comedies"].extend(script)

    # Miyazaki
    print("Parsing Totoro...")
    new_data["Miyazaki"] = []
    totoro_path = 'scripts/miyazaki/totoro.txt'
    if os.path.exists(totoro_path):
        new_data["Miyazaki"].extend(parse_totoro(totoro_path))

    # LOTR
    print("Parsing LOTR...")
    new_data["Lord of the Rings"] = []

    fellowship_path = 'scripts/lotr/fellowship.html'
    if os.path.exists(fellowship_path):
        new_data["Lord of the Rings"].extend(parse_fellowship_transcript(fellowship_path))

    for f in ['two_towers.html', 'return_of_the_king.html']:
        path = os.path.join('scripts/lotr', f)
        title = f.replace('.html', '').replace('_', ' ').replace('-', ' ').title()
        # Clean up title: "Lord Of The Rings The Two Towers" -> "The Two Towers"
        # Simplification: just use filename title for now.
        if os.path.exists(path):
            new_data["Lord of the Rings"].extend(parse_imsdb_html(path, title))

    # Filter out empty entries
    for key in new_data:
        new_data[key] = [x for x in new_data[key] if x.get('text') and x.get('character')]

    # Merge
    if os.path.exists('script.json'):
        with open('script.json', 'r') as f:
            existing = json.load(f)
    else:
        existing = {}

    existing.update(new_data)

    with open('script.json', 'w') as f:
        json.dump(existing, f, indent=2)

    print("Done!")

if __name__ == "__main__":
    main()
