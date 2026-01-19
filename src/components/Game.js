import { track } from '../utils/analytics.js';
import { getCurrentDate } from '../utils/time.js';

export class Game {
  constructor(container, pack, scripts) {
    this.container = container;
    this.pack = pack;
    this.scripts = scripts;

    // Flatten all lines from all movies into one array with movie context
    // Sort by movieId to ensure consistent ordering
    this.allLines = [];
    const sortedMovies = Object.entries(scripts).sort((a, b) => a[0].localeCompare(b[0]));
    for (const [movieId, script] of sortedMovies) {
      script.lines.forEach((line, idx) => {
        this.allLines.push({
          ...line,
          movie: script.title,
          movieId: movieId,
          originalIndex: idx,
          year: script.year,
        });
      });
    }

    // Build metadata
    this.metadata = this.buildMetadata();

    // Game state
    this.targetIndex = -1;
    this.currentAttempt = 0;
    this.gameOver = false;
    this.movieLocked = false;
    this.guessHistory = [];
  }

  buildMetadata() {
    const movieYears = {};
    const characters = {};

    this.allLines.forEach(line => {
      if (!movieYears[line.movie]) {
        movieYears[line.movie] = line.year;
      }
      if (!characters[line.movie]) {
        characters[line.movie] = new Set();
      }
      characters[line.movie].add(line.character);
    });

    // Sort movies by year (if available), then alphabetically
    const sortedMovies = Object.keys(movieYears).sort((a, b) => {
      const yearA = movieYears[a];
      const yearB = movieYears[b];
      // Movies with years come first, sorted by year
      if (yearA && yearB) return yearA - yearB;
      if (yearA && !yearB) return -1;
      if (!yearA && yearB) return 1;
      // Both without years - sort alphabetically
      return a.localeCompare(b);
    });

    return {
      movies: sortedMovies,
      movieYears: movieYears,
      characters: Object.fromEntries(
        Object.entries(characters).map(([m, chars]) => [m, Array.from(chars).sort()])
      ),
    };
  }

  start() {
    track('game_start', { pack_id: this.pack.id, game_type: 'pack' });
    this.selectTarget();
    this.render();
    this.bindEvents();
  }

  // Seeded RNG
  mulberry32(seed) {
    return function () {
      let t = seed += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  getDateSeed() {
    const today = getCurrentDate();
    let hash = 0;
    for (let i = 0; i < today.length; i++) {
      hash = ((hash << 5) - hash) + today.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  selectTarget() {
    // Per-pack daily seed
    const today = getCurrentDate();
    const dateSeed = this.getDateSeed();
    const packHash = this.hashString(this.pack.id);
    const combinedSeed = dateSeed + packHash;

    console.log('Date:', today, 'DateSeed:', dateSeed, 'PackHash:', packHash, 'Combined:', combinedSeed);

    const rng = this.mulberry32(combinedSeed);

    // Need padding for context lines
    const minIndex = 1;
    const maxIndex = this.allLines.length - 6;

    if (maxIndex < minIndex) {
      this.targetIndex = 0;
      return;
    }

    const randomValue = rng();
    this.targetIndex = minIndex + Math.floor(randomValue * (maxIndex - minIndex));
    console.log('RNG value:', randomValue, 'Target index:', this.targetIndex, 'Total lines:', this.allLines.length);
  }

  render() {
    const target = this.allLines[this.targetIndex];

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
              ${this.metadata.movies.map(m => {
      const year = this.metadata.movieYears?.[m];
      const label = year ? `${m} (${year})` : m;
      return `<option value="${m}">${label}</option>`;
    }).join('')}
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

    if (this.allLines.length === 0) {
      container.innerHTML = '<div style="text-align:center;">No script data available.</div>';
      return;
    }

    if (this.gameOver) {
      // Show context after game ends
      this.renderLine(this.targetIndex - 1, true);
      this.renderLine(this.targetIndex, false);
      for (let i = 1; i <= 5; i++) {
        this.renderLine(this.targetIndex + i, true);
      }
      this.updateSharePreview();
      return;
    }

    // Target line - character selector in place of name
    const targetLine = this.allLines[this.targetIndex];

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
    textDiv.textContent = targetLine.text;

    div.appendChild(charDiv);
    div.appendChild(textDiv);
    container.appendChild(div);

    // Progressive clues
    if (this.currentAttempt >= 1) this.renderClueLine(this.targetIndex + 1, this.currentAttempt >= 2);
    if (this.currentAttempt >= 3) this.renderClueLine(this.targetIndex + 2, this.currentAttempt >= 4);

    // Trigger character dropdown update
    this.onMovieChange();
  }

  renderClueLine(idx, revealChar) {
    if (idx >= this.allLines.length) return;
    const line = this.allLines[idx];

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

  renderLine(idx, isContext) {
    if (idx < 0 || idx >= this.allLines.length) return;
    const line = this.allLines[idx];

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

    if (movie && this.metadata.characters[movie]) {
      this.metadata.characters[movie].forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        charSelect.appendChild(opt);
      });
      charSelect.disabled = false;

      if (currentVal && this.metadata.characters[movie].includes(currentVal)) {
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

    const target = this.allLines[this.targetIndex];
    const movieCorrect = movieGuess === target.movie;
    const charCorrect = charGuess.toUpperCase() === target.character.toUpperCase();

    this.guessHistory.push({ movie: movieCorrect, char: charCorrect });

    track('guess', {
      pack_id: this.pack.id,
      attempt: this.guessHistory.length,
      movie_correct: movieCorrect,
      char_correct: charCorrect
    });

    if (movieCorrect) {
      this.movieLocked = true;
      movieSelect.disabled = true;
    } else if (!this.movieLocked) {
      movieSelect.value = '';
      this.onMovieChange();
    }

    if (movieCorrect && charCorrect) {
      track('game_complete', {
        pack_id: this.pack.id,
        success: true,
        attempts: this.guessHistory.length
      });
      this.showMessage(`Correct! It was ${target.character} in ${target.movie}.`, 'success');
      this.gameOver = true;
      this.renderScript();
      document.getElementById('game-controls').style.display = 'none';
      document.getElementById('share-container').style.display = 'flex';
    } else {
      this.currentAttempt++;
      document.getElementById('attempt-count').textContent = this.currentAttempt;

      if (this.currentAttempt >= 5) {
        track('game_complete', {
          pack_id: this.pack.id,
          success: false,
          attempts: this.guessHistory.length
        });
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
    let grid = `Scriptle: ${this.pack.name}\n\n`;

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
    track('share', { pack_id: this.pack.id, method: 'clipboard' });

    const lastGuess = this.guessHistory[this.guessHistory.length - 1];
    const success = lastGuess && lastGuess.movie && lastGuess.char;
    const shareText = this.generateShareString(success);

    // Try modern clipboard API first (works on HTTPS)
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(shareText);
        const btn = document.getElementById('share-btn');
        const original = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => btn.textContent = original, 2000);
        return;
      } catch (err) {
        console.error('Clipboard API failed:', err);
      }
    }

    // Fallback for iOS and older browsers - use textarea method
    try {
      const textarea = document.createElement('textarea');
      textarea.value = shareText;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();

      const successful = document.execCommand('copy');
      document.body.removeChild(textarea);

      if (successful) {
        const btn = document.getElementById('share-btn');
        const original = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => btn.textContent = original, 2000);
        return;
      }
    } catch (err) {
      console.error('Textarea fallback failed:', err);
    }

    // Final fallback - show in alert for manual copy
    alert('Failed to copy to clipboard.\n\n' + shareText);
  }
}
