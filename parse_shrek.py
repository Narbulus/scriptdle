import re
import json
import sys

def parse_shrek_text(filepath):
    """
    Parses a text file in the IMSDb format:
    Character names are indented and all caps.
    Dialogue follows.

    Structure to look for:
    SPACE SPACE SPACE SPACE SPACE CHARACTER NAME
    SPACE SPACE SPACE SPACE SPACE Dialogue line...
    """

    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    script_data = []

    # Heuristic:
    # Character names are usually indented by ~35-40 spaces?
    # Dialogue is indented by ~25 spaces?
    # Let's inspect the file content to be sure.
    # Based on the provided text, it looks like:
    #                                      SHREK
    #                          Once upon a time...

    # Regex for character: ^\s{30,}[A-Z0-9 ]+$  (Roughly)
    # Regex for dialogue: ^\s{20,}[^ ].*

    current_char = None
    current_dialogue = []

    # We will build a list of (Character, Text) tuples
    # Then post-process to join multi-line dialogue.

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue

        # Check indentation
        indent = len(line) - len(line.lstrip())

        # Character detection
        # IMSDb usually centers characters. In the sample:
        # "                                     SHREK" -> 37 spaces
        # "                         Once upon a time..." -> 25 spaces

        # NOTE: Some lines might be scene headers "               NIGHT - NEAR SHREK'S HOME"
        # Scene headers are usually ALL CAPS too.
        # Characters are usually shorter.

        if indent > 30 and stripped.isupper() and not " - " in stripped:
             # Likely a character
             # If we have pending dialogue, save it
             if current_char and current_dialogue:
                 full_text = " ".join(current_dialogue)
                 script_data.append({
                     "movie": "Shrek",
                     "character": current_char,
                     "text": full_text
                 })
                 current_dialogue = []

             # Remove parentheticals from character name if any (e.g. "SHREK (cont'd)")
             # The sample text has "SHREK" or "MAN1"
             current_char = re.sub(r'\s*\(.*\)', '', stripped).strip()

        elif indent > 15 and indent < 35:
             # Likely dialogue
             # Check if it's a parenthetical action (e.g. "(laughs)")
             if stripped.startswith('(') and stripped.endswith(')'):
                 continue # Skip parentheticals in dialogue for now? Or keep them?
                 # Wordle game usually uses spoken text. "laughs" isn't spoken.

             if current_char:
                 current_dialogue.append(stripped)

    # Flush last
    if current_char and current_dialogue:
        full_text = " ".join(current_dialogue)
        script_data.append({
            "movie": "Shrek",
            "character": current_char,
            "text": full_text
        })

    return script_data

if __name__ == "__main__":
    data = parse_shrek_text("shrek_1.txt")
    print(json.dumps(data, indent=2))
