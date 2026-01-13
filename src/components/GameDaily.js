/**
 * GameDaily - Simplified game class for pre-generated daily puzzles
 * No RNG, no full script access - only the minimal puzzle data
 */
export class GameDaily {
  constructor(container, manifest, dailyPuzzle) {
    this.container = container;
    this.manifest = manifest;
    this.pack = {
      id: dailyPuzzle.packId,
      name: manifest.packName,
      theme: manifest.theme
    };
    this.puzzle = dailyPuzzle.puzzle;
    this.metadata = dailyPuzzle.metadata;

    // Game state
    this.currentAttempt = 0;
    this.gameOver = false;
    this.movieLocked = false;
    this.guessHistory = [];
  }

  start() {
    // No target selection needed - puzzle is pre-determined
    this.render();
    this.bindEvents();
  }

  render() {
    const target = this.puzzle.targetLine;

    this.container.innerHTML = `
      <!-- Script Title Section -->
      <div class="script-title-section">
        <div class="script-title">${this.pack.name}</div>
        <div class="script-subtitle">${this.metadata.movies.length} Movies</div>
      </div>

      <!-- Main Script Area -->
      <div class="script-area">
        <div class="script-content">
          <!-- Movie Selector -->
          <div class="movie-select-wrapper">
            <select id="movie-select">
              <option value="">Choose the Film</option>
              ${this.metadata.movies.map(m => `<option value="${m}">${m}</option>`).join('')}
            </select>
            <div id="movie-error" class="form-error"></div>
          </div>

          <div class="script-then">Then</div>

          <!-- Script Lines (includes inline character selector) -->
          <div id="script-display"></div>
        </div>
      </div>

      <!-- Footer with Controls -->
      <div class="game-footer">
        <div id="message" class="message" style="display: none;"></div>

        <div id="game-controls" class="footer-controls" ${this.gameOver ? 'style="display:none;"' : ''}>
          <div class="footer-attempts">Attempts: <span id="attempt-count">${this.currentAttempt}</span>/5</div>
          <div class="footer-button-wrapper">
            <button id="guess-btn">Make Your Guess</button>
          </div>
        </div>

        <div id="share-container">
          <div style="font-size: 0.9rem; color: #666; margin-bottom: 0.5rem;">Share Preview:</div>
          <div id="share-preview"></div>
          <button id="share-btn">Copy to Clipboard</button>
        </div>
      </div>
    `;

    this.renderScript();

    if (this.movieLocked) {
      const movieSelect = document.getElementById('movie-select');
      movieSelect.value = target.movie;
      movieSelect.disabled = true;
    }
  }

  renderScript() {
    const container = document.getElementById('script-display');
    container.innerHTML = '';

    if (this.gameOver) {
      // Show context after game ends
      if (this.puzzle.contextBefore) {
        this.renderContextLine(this.puzzle.contextBefore, true);
      }
      this.renderTargetLine(false); // Target line (not context)
      this.puzzle.contextAfter.forEach(line => {
        this.renderContextLine(line, true);
      });
      this.updateSharePreview();
      return;
    }

    // Target line - character selector in place of name
    const div = document.createElement('div');
    div.className = 'script-line';

    const charDiv = document.createElement('div');
    charDiv.className = 'character-name';

    // Create character selector inline
    const select = document.createElement('select');
    select.id = 'char-select';
    select.className = 'char-select-inline';
    select.disabled = true;
    select.innerHTML = '<option value="">Choose the Character</option>';
    charDiv.appendChild(select);

    // Add error message container
    const errorDiv = document.createElement('div');
    errorDiv.id = 'char-error';
    errorDiv.className = 'form-error';
    charDiv.appendChild(errorDiv);

    const textDiv = document.createElement('div');
    textDiv.className = 'dialogue-text';
    textDiv.textContent = this.puzzle.targetLine.text;

    div.appendChild(charDiv);
    div.appendChild(textDiv);
    container.appendChild(div);

    // Progressive clues
    if (this.currentAttempt >= 1 && this.puzzle.contextAfter.length > 0) {
      this.renderClueLine(this.puzzle.contextAfter[0], this.currentAttempt >= 2);
    }
    if (this.currentAttempt >= 3 && this.puzzle.contextAfter.length > 1) {
      this.renderClueLine(this.puzzle.contextAfter[1], this.currentAttempt >= 4);
    }

    // Trigger character dropdown update
    this.onMovieChange();
  }

  renderClueLine(line, revealChar) {
    const div = document.createElement('div');
    div.className = 'script-line';

    const charDiv = document.createElement('div');
    charDiv.className = 'character-name';
    charDiv.textContent = revealChar ? line.character : '???';

    const textDiv = document.createElement('div');
    textDiv.className = 'dialogue-text';
    textDiv.textContent = line.text;

    div.appendChild(charDiv);
    div.appendChild(textDiv);
    document.getElementById('script-display').appendChild(div);
  }

  renderTargetLine(isContext) {
    const line = this.puzzle.targetLine;
    const div = document.createElement('div');
    div.className = 'script-line';
    if (isContext) div.classList.add('context-line');

    const charDiv = document.createElement('div');
    charDiv.className = 'character-name';
    charDiv.textContent = line.character;

    const textDiv = document.createElement('div');
    textDiv.className = 'dialogue-text';
    textDiv.textContent = line.text;

    div.appendChild(charDiv);
    div.appendChild(textDiv);
    document.getElementById('script-display').appendChild(div);
  }

  renderContextLine(line, isContext) {
    const div = document.createElement('div');
    div.className = 'script-line';
    if (isContext) div.classList.add('context-line');

    const charDiv = document.createElement('div');
    charDiv.className = 'character-name';
    charDiv.textContent = line.character;

    const textDiv = document.createElement('div');
    textDiv.className = 'dialogue-text';
    textDiv.textContent = line.text;

    div.appendChild(charDiv);
    div.appendChild(textDiv);
    document.getElementById('script-display').appendChild(div);
  }

  onMovieChange() {
    const movieSelect = document.getElementById('movie-select');
    const charSelect = document.getElementById('char-select');
    const movieError = document.getElementById('movie-error');

    if (!charSelect) return;

    const movie = movieSelect.value;
    const currentVal = charSelect.value;

    // Clear movie error
    if (movieError) {
      movieError.style.display = 'none';
    }

    charSelect.innerHTML = '<option value="">Choose the Character</option>';

    if (movie && this.metadata.charactersByMovie[movie]) {
      this.metadata.charactersByMovie[movie].forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        charSelect.appendChild(opt);
      });
      charSelect.disabled = false;

      if (currentVal && this.metadata.charactersByMovie[movie].includes(currentVal)) {
        charSelect.value = currentVal;
      }
    } else {
      charSelect.disabled = true;
    }
  }

  onCharChange() {
    const charError = document.getElementById('char-error');
    if (charError) {
      charError.style.display = 'none';
    }
  }

  bindEvents() {
    document.getElementById('movie-select').addEventListener('change', () => this.onMovieChange());
    document.getElementById('char-select').addEventListener('change', () => this.onCharChange());
    document.getElementById('guess-btn').addEventListener('click', () => this.submitGuess());
    document.getElementById('share-btn').addEventListener('click', () => this.copyShare());
  }

  submitGuess() {
    if (this.gameOver) return;

    const movieSelect = document.getElementById('movie-select');
    const charSelect = document.getElementById('char-select');
    const movieError = document.getElementById('movie-error');
    const charError = document.getElementById('char-error');

    const movieGuess = movieSelect.value;
    const charGuess = charSelect.value;

    // Clear previous errors
    if (movieError) movieError.style.display = 'none';
    if (charError) charError.style.display = 'none';

    // Validate movie selection
    if (!movieGuess) {
      if (movieError) {
        movieError.textContent = 'Please select a movie';
        movieError.style.display = 'block';
      }
      return;
    }

    // Validate character selection
    if (!charGuess) {
      if (charError) {
        charError.textContent = 'Please select a character';
        charError.style.display = 'block';
      }
      return;
    }

    const target = this.puzzle.targetLine;
    const movieCorrect = movieGuess === target.movie;
    const charCorrect = charGuess.toUpperCase() === target.character.toUpperCase();

    this.guessHistory.push({ movie: movieCorrect, char: charCorrect });

    if (movieCorrect) {
      this.movieLocked = true;
      movieSelect.disabled = true;
    } else if (!this.movieLocked) {
      movieSelect.value = '';
      this.onMovieChange();
    }

    if (movieCorrect && charCorrect) {
      this.showMessage(`Correct! It was ${target.character} in ${target.movie}.`, 'success');
      this.gameOver = true;
      this.renderScript();
      document.getElementById('game-controls').style.display = 'none';
      document.getElementById('share-container').style.display = 'flex';
    } else {
      this.currentAttempt++;
      document.getElementById('attempt-count').textContent = this.currentAttempt;

      if (this.currentAttempt >= 5) {
        this.showMessage(`Game Over! It was ${target.character} in ${target.movie}.`, 'error');
        this.gameOver = true;
        this.renderScript();
        document.getElementById('game-controls').style.display = 'none';
        document.getElementById('share-container').style.display = 'flex';
      } else {
        let msg = 'Incorrect.';
        if (movieCorrect) msg = 'Movie is correct! Character is wrong.';
        this.showMessage(msg + ' New clue revealed!', 'error');
        this.renderScript();
        if (this.movieLocked) {
          document.getElementById('movie-select').value = target.movie;
          document.getElementById('movie-select').disabled = true;
          this.onMovieChange();
          document.getElementById('char-select').value = '';
        }
      }
    }
  }

  showMessage(msg, type) {
    const el = document.getElementById('message');
    el.textContent = msg;
    el.className = 'message ' + type;
    el.style.display = 'block';
  }

  generateShareString(success) {
    const date = new Date().toISOString().split('T')[0];
    const attemptCount = success ? this.guessHistory.length : 'X';
    let grid = `Scriptle (${this.pack.name}) ${date} ${attemptCount}/5\n\n`;

    let movieRow = '';
    let charRow = '';

    for (let i = 0; i < 5; i++) {
      if (i < this.guessHistory.length) {
        const guess = this.guessHistory[i];
        movieRow += guess.movie ? '🟢' : '⚫';
        charRow += guess.char ? '🟢' : '⚫';
      } else {
        movieRow += '⚪';
        charRow += '⚪';
      }
    }

    grid += movieRow + '\n' + charRow;
    grid += '\n\n' + window.location.href;
    return grid;
  }

  updateSharePreview() {
    const lastGuess = this.guessHistory[this.guessHistory.length - 1];
    const success = lastGuess && lastGuess.movie && lastGuess.char;
    const shareText = this.generateShareString(success);
    document.getElementById('share-preview').textContent = shareText;
  }

  async copyShare() {
    const lastGuess = this.guessHistory[this.guessHistory.length - 1];
    const success = lastGuess && lastGuess.movie && lastGuess.char;
    const shareText = this.generateShareString(success);

    try {
      await navigator.clipboard.writeText(shareText);
      const btn = document.getElementById('share-btn');
      const original = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(() => btn.textContent = original, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      alert('Failed to copy to clipboard.\n\n' + shareText);
    }
  }
}
