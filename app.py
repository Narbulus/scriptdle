from flask import Flask, render_template, jsonify, request, session
import json
import random
import datetime
import os

app = Flask(__name__)
app.secret_key = 'super_secret_key_for_dev' # In prod, use env var

# Load script
SCRIPT_PATH = 'script.json'
# We assume script.json contains a list of lines from various movies.
# Currently it has lines from Pulp Fiction.
with open(SCRIPT_PATH, 'r') as f:
    SCRIPT_DATA = json.load(f)

def get_daily_index():
    today = datetime.datetime.utcnow().date().isoformat()
    # Use simple hash of date string to pick an index
    random.seed(today)
    # Filter valid indices (must have at least 2 following lines for the game logic)
    valid_indices = range(len(SCRIPT_DATA) - 2)
    idx = random.choice(valid_indices)
    return idx, today

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/game', methods=['GET'])
def get_game():
    idx, date_str = get_daily_index()

    line1 = SCRIPT_DATA[idx]

    # Initial state: Show Line 1 Text only.
    return jsonify({
        "game_id": date_str,
        "clues": [
            {"type": "text", "content": line1['text'], "label": "Line 1"}
        ],
        "attempt": 0,
        "max_attempts": 5
    })

@app.route('/api/guess', methods=['POST'])
def guess():
    data = request.json
    char_guess = data.get('character_guess', '').strip().upper()
    movie_guess = data.get('movie_guess', '').strip().upper()
    current_attempt = data.get('attempt', 0)

    idx, date_str = get_daily_index()

    target_line = SCRIPT_DATA[idx]
    target_char = target_line['character'].upper()
    target_movie = target_line['movie'].upper()

    char_correct = (char_guess == target_char)
    movie_correct = (movie_guess == target_movie)

    if char_correct and movie_correct:
        return jsonify({
            "correct": True,
            "movie_correct": True,
            "message": f"Correct! It was {target_line['character']} in {target_line['movie']}.",
            "target_character": target_line['character'],
            "target_movie": target_line['movie']
        })
    else:
        # Wrong guess. Reveal next clue.
        next_attempt = current_attempt + 1

        if next_attempt >= 5:
            return jsonify({
                "correct": False,
                "game_over": True,
                "message": f"Game Over! It was {target_line['character']} in {target_line['movie']}.",
                "target_character": target_line['character'],
                "target_movie": target_line['movie']
            })

        # Reveal logic
        clues = []
        # Always include Line 1
        clues.append({"type": "text", "content": target_line['text'], "label": "Line 1"})

        line2 = SCRIPT_DATA[idx + 1]
        line3 = SCRIPT_DATA[idx + 2]

        if next_attempt >= 1:
            clues.append({"type": "text", "content": line2['text'], "label": "Line 2"})

        if next_attempt >= 2:
            clues.append({"type": "character", "content": line2['character'], "label": f"Character ({line2['original_character']})"})

        if next_attempt >= 3:
            clues.append({"type": "text", "content": line3['text'], "label": "Line 3"})

        if next_attempt >= 4:
            clues.append({"type": "character", "content": line3['character'], "label": f"Character ({line3['original_character']})"})

        return jsonify({
            "correct": False,
            "movie_correct": movie_correct,
            "game_over": False,
            "attempt": next_attempt,
            "clues": clues
        })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
