import pymupdf
import json
import re

def parse_script(pdf_path, output_json):
    doc = pymupdf.open(pdf_path)
    script_lines = []

    # Heuristic margin for dialogue blocks in Pulp Fiction PDF
    MIN_X = 168
    MAX_X = 172

    movie_title = "Pulp Fiction"

    for page_num, page in enumerate(doc):
        blocks = page.get_text("blocks")
        # Sort blocks by vertical position (y0) just in case, though usually sorted
        blocks.sort(key=lambda b: b[1])

        for b in blocks:
            x0 = b[0]
            text = b[4]

            if MIN_X <= x0 <= MAX_X:
                lines = text.strip().splitlines()
                if not lines:
                    continue

                character_raw = lines[0].strip()

                # Check if it looks like a character name (mostly uppercase)
                # Allow some punctuation or (CONT'D)
                # Remove parentheticals for the "clean" name
                character_clean = re.sub(r'\s*\(.*?\)', '', character_raw).strip()

                if not character_clean.isupper():
                    # Might be a parenthetical starting the block?
                    # " (laughing) \n Not this life."
                    # If the first line is parenthetical, maybe the previous block was the character?
                    # But usually name is first.
                    # If strictly uppercase check fails, maybe log it.
                    # In Pulp Fiction, names like "YOUNG MAN" are all caps.
                    # "Garcon! Coffee!" is dialogue? No, that's text.
                    # "YOUNG MAN" is the name.
                    continue

                dialogue_lines = lines[1:]
                if not dialogue_lines:
                    continue

                dialogue_text = "\n".join([l.strip() for l in dialogue_lines])

                # Remove parentheticals from dialogue for display?
                # Or keep them. Let's keep them for now but maybe clean up newlines.

                entry = {
                    "movie": movie_title,
                    "character": character_clean, # The name to guess
                    "original_character": character_raw, # Including (CONT'D) etc
                    "text": dialogue_text
                }

                script_lines.append(entry)

    print(f"Parsed {len(script_lines)} lines.")

    with open(output_json, 'w') as f:
        json.dump(script_lines, f, indent=2)

if __name__ == "__main__":
    parse_script("pulp_fiction.pdf", "script.json")
