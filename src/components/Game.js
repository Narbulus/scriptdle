export class Game {
  constructor(container, pack, scripts) {
    this.container = container;
    this.pack = pack;
    this.scripts = scripts;

    // Flatten all lines from all movies into one array with movie context
    this.allLines = [];
    for (const [movieId, script] of Object.entries(scripts)) {
      script.lines.forEach((line, idx) => {
        this.allLines.push({
          ...line,
          movie: script.title,
          movieId: movieId,
          originalIndex: idx,
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
    const movies = new Set();
    const characters = {};

    this.allLines.forEach(line => {
      movies.add(line.movie);
      if (!characters[line.movie]) {
        characters[line.movie] = new Set();
      }
      characters[line.movie].add(line.character);
    });

    return {
      movies: Array.from(movies).sort(),
      characters: Object.fromEntries(
        Object.entries(characters).map(([m, chars]) => [m, Array.from(chars).sort()])
      ),
    };
  }

  start() {
    this.selectTarget();
    this.render();
    this.bindEvents();
  }

  // Seeded RNG
  mulberry32(a) {
    return function() {
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  getDateSeed() {
    const today = new Date().toISOString().split('T')[0];
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
    const dateSeed = this.getDateSeed();
    const packHash = this.hashString(this.pack.id);
    const combinedSeed = dateSeed + packHash;

    const rng = this.mulberry32(combinedSeed);

    // Need padding for context lines
    const minIndex = 1;
    const maxIndex = this.allLines.length - 6;

    if (maxIndex < minIndex) {
      this.targetIndex = 0;
      return;
    }

    this.targetIndex = minIndex + Math.floor(rng() * (maxIndex - minIndex));
    console.log('Game seed:', combinedSeed, 'Target index:', this.targetIndex);
  }

  render() {
    const target = this.allLines[this.targetIndex];

    this.container.innerHTML = `
      <h1>${this.pack.name}</h1>

      <div class="controls-top">
        <select id="movie-select" style="max-width:300px;">
          <option value="">Select Movie...</option>
          ${this.metadata.movies.map(m => `<option value="${m}">${m}</option>`).join('')}
        </select>
      </div>

      <div id="script-display"></div>

      <div id="game-controls" class="controls-bottom" ${this.gameOver ? 'style="display:none;"' : ''}>
        <button id="guess-btn">Guess</button>
        <div style="margin-top:0.5rem; color:#666;">Attempts: <span id="attempt-count">${this.currentAttempt}</span>/5</div>
      </div>

      <div id="message" class="message" style="display: none;"></div>

      <div id="share-container">
        <div style="font-size: 0.9rem; color: #666; margin-bottom: 0.5rem;">Share Preview:</div>
        <div id="share-preview"></div>
        <button id="share-btn">Copy to Clipboard</button>
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

    // Target line with character dropdown
    const targetLine = this.allLines[this.targetIndex];

    const div = document.createElement('div');
    div.className = 'script-line';

    const charDiv = document.createElement('div');
    charDiv.className = 'character-name';

    const select = document.createElement('select');
    select.id = 'char-select';
    select.className = 'char-select-inline';
    select.innerHTML = '<option value="">(SELECT CHARACTER)</option>';
    select.disabled = true;
    charDiv.appendChild(select);

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
    if (!charSelect) return;

    const movie = movieSelect.value;
    const currentVal = charSelect.value;

    charSelect.innerHTML = '<option value="">(SELECT CHARACTER)</option>';

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

  bindEvents() {
    document.getElementById('movie-select').addEventListener('change', () => this.onMovieChange());
    document.getElementById('guess-btn').addEventListener('click', () => this.submitGuess());
    document.getElementById('share-btn').addEventListener('click', () => this.copyShare());
  }

  submitGuess() {
    if (this.gameOver) return;

    const movieSelect = document.getElementById('movie-select');
    const charSelect = document.getElementById('char-select');

    const movieGuess = movieSelect.value;
    const charGuess = charSelect.value;

    if (!movieGuess) {
      this.showMessage('Please select a movie.', 'error');
      return;
    }
    if (!charGuess) {
      this.showMessage('Please select a character.', 'error');
      return;
    }

    const target = this.allLines[this.targetIndex];
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
