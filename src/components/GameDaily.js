/**
 * GameDaily - Simplified game class for pre-generated daily puzzles
 * No RNG, no full script access - only the minimal puzzle data
 */

const STORAGE_VERSION = 2;

export class GameDaily {
  constructor(container, manifest, dailyPuzzle, allPacks = [], packData = null) {
    this.container = container;
    this.manifest = manifest;
    this.pack = {
      id: dailyPuzzle.packId,
      name: manifest.packName,
      theme: manifest.theme
    };
    this.puzzle = dailyPuzzle.puzzle;
    this.metadata = dailyPuzzle.metadata;
    this.allPacks = allPacks;
    this.packData = packData;
    this.date = dailyPuzzle.date;

    // Game state
    this.currentAttempt = 0;
    this.gameOver = false;
    this.movieLocked = false;
    this.guessHistory = [];
  }

  start() {
    // Check if already completed or in progress
    const savedProgress = this.loadProgress();
    if (savedProgress) {
      // Restore state
      this.gameOver = savedProgress.gameOver;
      this.currentAttempt = savedProgress.attempts;
      this.movieLocked = savedProgress.movieLocked || false;

      // Restore guess history
      if (savedProgress.guessHistory) {
        this.guessHistory = savedProgress.guessHistory;
      } else {
        // Backward compatibility - reconstruct from old format
        this.guessHistory = this.reconstructGuessHistory(savedProgress);
      }
    }

    // No target selection needed - puzzle is pre-determined
    this.render();
    this.bindEvents();

    // Restore movie selector if needed
    if (savedProgress && savedProgress.selectedMovie) {
      const movieSelect = document.getElementById('movie-select');
      if (movieSelect) {
        movieSelect.value = savedProgress.selectedMovie;
        movieSelect.disabled = this.movieLocked;
        this.onMovieChange();
      }
    }

    // If game is over, show completion UI after render completes
    if (savedProgress && savedProgress.gameOver) {
      // Use requestAnimationFrame to ensure DOM is fully painted
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          this.showCompletionUI(savedProgress.success);
        });
      });
    }
  }

  showCompletionUI(success) {
    // Show appropriate message
    const target = this.puzzle.targetLine;
    if (success) {
      this.showMessage(`Correct! It was ${target.character} in ${target.movie}.`, 'success');
    } else {
      this.showMessage(`Game Over! It was ${target.character} in ${target.movie}.`, 'error');
    }

    // Show share container
    document.getElementById('game-controls').style.display = 'none';
    document.getElementById('share-container').style.display = 'flex';

    // Update final attempt counter
    const finalCount = document.getElementById('attempt-count-final');
    if (finalCount) finalCount.textContent = this.currentAttempt;
  }

  reconstructGuessHistory(savedProgress) {
    // Reconstruct a minimal guess history for rendering purposes
    const history = [];
    const target = this.puzzle.targetLine;

    for (let i = 0; i < savedProgress.attempts; i++) {
      if (i === savedProgress.attempts - 1) {
        // Last guess - use actual success state
        history.push({
          movie: savedProgress.success,
          char: savedProgress.success
        });
      } else {
        // Earlier guesses - assume they were wrong (for visual purposes only)
        history.push({
          movie: false,
          char: false
        });
      }
    }

    return history;
  }

  render() {
    const target = this.puzzle.targetLine;

    this.container.innerHTML = `
      <!-- Script Title Section -->
      <div class="script-title-section">
        <div class="script-title">${this.pack.name}</div>
        <div id="subtitle-message" class="script-subtitle">${this.metadata.movies.length} Movies</div>
      </div>

      <!-- Main Script Area -->
      <div class="script-area">
        <div class="script-content">
          <!-- Script Lines -->
          <div id="script-display"></div>
        </div>
      </div>

      <!-- Footer with Controls -->
      <div class="game-footer">
        <div id="message" class="message" style="display: none;"></div>

        <div id="game-controls" ${this.gameOver ? 'style="display:none;"' : ''}>
          <div class="footer-selectors">
            <div class="select-wrapper">
              <select id="movie-select">
                <option value="">Film</option>
                ${this.metadata.movies.map(m => {
                  const year = this.metadata.movieYears?.[m];
                  const label = year ? `${m} (${year})` : m;
                  return `<option value="${m}">${label}</option>`;
                }).join('')}
              </select>
            </div>
            <div class="select-wrapper">
              <select id="char-select" disabled>
                <option value="">Character</option>
              </select>
            </div>
          </div>
          <div id="movie-error" class="form-error"></div>
          <div id="char-error" class="form-error"></div>
          <div class="footer-actions">
            <button id="guess-btn">Make Your Guess</button>
            <div class="footer-meta">
              <div class="footer-attempts"><span id="attempt-count">${this.currentAttempt}</span>/5 Attempts</div>
              <a href="/" data-link class="footer-more-movies">More Movies</a>
            </div>
          </div>
        </div>

        <div id="share-container" style="display: ${this.gameOver ? 'flex' : 'none'}; flex-direction: column; align-items: center; gap: 1rem;">
          <button id="share-btn">Share Results</button>
          <div class="footer-meta">
            <div class="footer-attempts"><span id="attempt-count-final">${this.currentAttempt}</span>/5 Attempts</div>
            <a href="/" data-link class="footer-more-movies">More Movies</a>
          </div>
        </div>

        <div id="other-packs-container"></div>
      </div>
    `;

    this.renderScript();
    this.renderOtherPacks();

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
      // Show target line
      this.renderTargetLine(false);

      // Show all context lines as revealed (with animation if they weren't shown before)
      if (this.puzzle.contextAfter.length > 0) {
        const wasRevealed1 = this.currentAttempt >= 1;
        this.renderContextLineFinal(this.puzzle.contextAfter[0], !wasRevealed1);
      }
      if (this.puzzle.contextAfter.length > 1) {
        const wasRevealed2 = this.currentAttempt >= 3;
        this.renderContextLineFinal(this.puzzle.contextAfter[1], !wasRevealed2);
      }

      // Update subtitle message
      this.updateSubtitleMessage();

      this.updateSharePreview();
      return;
    }

    // Target line - highlighted placeholder for character name
    const div = document.createElement('div');
    div.className = 'script-line';

    const charDiv = document.createElement('div');
    charDiv.className = 'character-name';

    // Placeholder styled like shimmer but with ???
    const placeholder = document.createElement('span');
    placeholder.className = 'character-placeholder';
    placeholder.textContent = '???';
    charDiv.appendChild(placeholder);

    const textDiv = document.createElement('div');
    textDiv.className = 'dialogue-text';
    textDiv.textContent = this.puzzle.targetLine.text;

    div.appendChild(charDiv);
    div.appendChild(textDiv);
    container.appendChild(div);

    // Always show context line placeholders, reveal based on attempts
    if (this.puzzle.contextAfter.length > 0) {
      const revealText1 = this.currentAttempt >= 1;
      const revealChar1 = this.currentAttempt >= 2;
      this.renderClueLine(this.puzzle.contextAfter[0], revealText1, revealChar1);
    }
    if (this.puzzle.contextAfter.length > 1) {
      const revealText2 = this.currentAttempt >= 3;
      const revealChar2 = this.currentAttempt >= 4;
      this.renderClueLine(this.puzzle.contextAfter[1], revealText2, revealChar2);
    }

    // Trigger character dropdown update
    this.onMovieChange();
  }

  renderClueLine(line, revealText, revealChar) {
    const div = document.createElement('div');
    div.className = 'script-line';

    const charDiv = document.createElement('div');
    charDiv.className = 'character-name';

    if (revealChar) {
      charDiv.textContent = line.character;
    } else {
      // Placeholder for character - real text but obscured
      const shimmer = document.createElement('span');
      shimmer.className = 'shimmer-text';
      shimmer.textContent = line.character;
      charDiv.appendChild(shimmer);
    }

    const textDiv = document.createElement('div');
    textDiv.className = 'dialogue-text';

    if (revealText) {
      textDiv.textContent = line.text;
    } else {
      // Placeholder for dialogue - real text but obscured
      const shimmer = document.createElement('span');
      shimmer.className = 'shimmer-text';
      shimmer.textContent = line.text;
      textDiv.appendChild(shimmer);
    }

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

  renderContextLineFinal(line, animate) {
    const div = document.createElement('div');
    div.className = 'script-line context-line';
    if (animate) {
      div.classList.add('reveal-animate');
    }

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

    charSelect.innerHTML = '<option value="">Character</option>';

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
    // Only bind game controls if they exist (game in progress)
    const movieSelect = document.getElementById('movie-select');
    const charSelect = document.getElementById('char-select');
    const guessBtn = document.getElementById('guess-btn');

    if (movieSelect) {
      movieSelect.addEventListener('change', () => this.onMovieChange());
    }
    if (charSelect) {
      charSelect.addEventListener('change', () => this.onCharChange());
    }
    if (guessBtn) {
      guessBtn.addEventListener('click', () => this.submitGuess());
    }

    // Share button exists when game is over
    const shareBtn = document.getElementById('share-btn');
    if (shareBtn) {
      shareBtn.addEventListener('click', () => this.shareResults());
    }
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
      this.saveProgress();
      this.renderScript();
      document.getElementById('game-controls').style.display = 'none';
      document.getElementById('share-container').style.display = 'flex';
      const finalCount = document.getElementById('attempt-count-final');
      if (finalCount) finalCount.textContent = this.currentAttempt;
    } else {
      this.currentAttempt++;
      document.getElementById('attempt-count').textContent = this.currentAttempt;

      if (this.currentAttempt >= 5) {
        this.showMessage(`Game Over! It was ${target.character} in ${target.movie}.`, 'error');
        this.gameOver = true;
        this.saveProgress();
        this.renderScript();
        document.getElementById('game-controls').style.display = 'none';
        document.getElementById('share-container').style.display = 'flex';
        const finalCount = document.getElementById('attempt-count-final');
        if (finalCount) finalCount.textContent = this.currentAttempt;
      } else {
        let msg = 'Incorrect.';
        if (movieCorrect) msg = 'Movie is correct! Character is wrong.';
        this.showMessage(msg + ' New clue revealed!', 'error');
        // Save progress after each guess
        this.saveProgress();
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
    if (!el) {
      console.error('Message element not found');
      return;
    }
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
    return grid;
  }

  generateShareData(success) {
    const text = this.generateShareString(success);
    return {
      text: text
    };
  }

  updateSharePreview() {
    this.renderOtherPacks();
  }

  renderCollapsibleContext(container) {
    // Create collapsible section for full context
    const contextSection = document.createElement('div');
    contextSection.style.marginTop = '2rem';
    contextSection.style.textAlign = 'center';

    // Toggle button
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'context-toggle';
    toggleBtn.style.background = 'transparent';
    toggleBtn.style.border = 'none';
    toggleBtn.style.color = 'var(--primary-color)';
    toggleBtn.style.cursor = 'pointer';
    toggleBtn.style.fontSize = '0.9rem';
    toggleBtn.style.fontWeight = 'bold';
    toggleBtn.style.textTransform = 'uppercase';
    toggleBtn.style.letterSpacing = '0.05em';
    toggleBtn.style.padding = '0.5rem';
    toggleBtn.innerHTML = 'See Full Context ▼';

    // Collapsible content (hidden by default)
    const contextContent = document.createElement('div');
    contextContent.id = 'context-content';
    contextContent.style.display = 'none';
    contextContent.style.marginTop = '1rem';

    // Add context before
    if (this.puzzle.contextBefore) {
      const beforeDiv = document.createElement('div');
      beforeDiv.className = 'script-line context-line';

      const charDiv = document.createElement('div');
      charDiv.className = 'character-name';
      charDiv.textContent = this.puzzle.contextBefore.character;

      const textDiv = document.createElement('div');
      textDiv.className = 'dialogue-text';
      textDiv.textContent = this.puzzle.contextBefore.text;

      beforeDiv.appendChild(charDiv);
      beforeDiv.appendChild(textDiv);
      contextContent.appendChild(beforeDiv);
    }

    // Add target line (in context style)
    const targetDiv = document.createElement('div');
    targetDiv.className = 'script-line';

    const targetCharDiv = document.createElement('div');
    targetCharDiv.className = 'character-name';
    targetCharDiv.textContent = this.puzzle.targetLine.character;

    const targetTextDiv = document.createElement('div');
    targetTextDiv.className = 'dialogue-text';
    targetTextDiv.textContent = this.puzzle.targetLine.text;

    targetDiv.appendChild(targetCharDiv);
    targetDiv.appendChild(targetTextDiv);
    contextContent.appendChild(targetDiv);

    // Add all context after lines
    this.puzzle.contextAfter.slice(0, 3).forEach(line => {
      const afterDiv = document.createElement('div');
      afterDiv.className = 'script-line context-line';

      const charDiv = document.createElement('div');
      charDiv.className = 'character-name';
      charDiv.textContent = line.character;

      const textDiv = document.createElement('div');
      textDiv.className = 'dialogue-text';
      textDiv.textContent = line.text;

      afterDiv.appendChild(charDiv);
      afterDiv.appendChild(textDiv);
      contextContent.appendChild(afterDiv);
    });

    // Toggle functionality
    toggleBtn.onclick = () => {
      if (contextContent.style.display === 'none') {
        contextContent.style.display = 'block';
        toggleBtn.innerHTML = 'Hide Context ▲';
      } else {
        contextContent.style.display = 'none';
        toggleBtn.innerHTML = 'See Full Context ▼';
      }
    };

    contextSection.appendChild(toggleBtn);
    contextSection.appendChild(contextContent);
    container.appendChild(contextSection);
  }

  updateSubtitleMessage() {
    const subtitle = document.getElementById('subtitle-message');
    if (!subtitle) return;

    // Determine tier
    const attemptCount = this.guessHistory.length;
    const success = this.guessHistory[this.guessHistory.length - 1]?.movie &&
                    this.guessHistory[this.guessHistory.length - 1]?.char;

    let tier;
    if (!success) {
      tier = 'failure';
    } else if (attemptCount === 1) {
      tier = 'perfect';
    } else if (attemptCount === 2) {
      tier = 'good';
    } else if (attemptCount === 3) {
      tier = 'average';
    } else {
      tier = 'barely';
    }

    // Get message from manifest
    const message = this.manifest.tierMessages?.[tier] || '';
    subtitle.textContent = message;
  }

  saveProgress() {
    const key = `scriptle:${this.pack.id}:${this.date}`;
    const lastGuess = this.guessHistory[this.guessHistory.length - 1];
    const success = lastGuess?.movie && lastGuess?.char;

    // Get selected movie for restoring dropdown
    const movieSelect = document.getElementById('movie-select');
    const selectedMovie = movieSelect ? movieSelect.value : null;

    const data = {
      v: STORAGE_VERSION,
      attempts: this.guessHistory.length,  // Actual number of attempts, not index
      success: this.gameOver ? success : null,
      gameOver: this.gameOver,
      guessHistory: this.guessHistory,
      movieLocked: this.movieLocked,
      selectedMovie: selectedMovie,
      completedAt: this.gameOver ? new Date().toISOString() : null
    };

    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (err) {
      console.error('Failed to save progress:', err);
    }
  }

  loadProgress() {
    const key = `scriptle:${this.pack.id}:${this.date}`;

    try {
      const stored = localStorage.getItem(key);
      if (!stored) return null;

      let data = JSON.parse(stored);

      // Migrate if needed
      if (!data.v) {
        data = { v: STORAGE_VERSION, ...data };
      }

      return data;
    } catch (err) {
      console.error('Failed to load progress:', err);
      return null;
    }
  }

  isPackCompletedToday(packId) {
    const key = `scriptle:${packId}:${this.date}`;
    try {
      const stored = localStorage.getItem(key);
      if (!stored) return false;
      const data = JSON.parse(stored);
      return data.gameOver && data.success;
    } catch (err) {
      return false;
    }
  }

  getPackPlayCount(packId) {
    // Count total games played (not just today) for this pack
    let count = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(`scriptle:${packId}:`)) {
        try {
          const data = JSON.parse(localStorage.getItem(key));
          if (data && data.gameOver) {
            count++;
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    }
    return count;
  }

  renderOtherPacks() {
    // No longer needed - "More Movies" is now inline with attempt counter
  }

  async shareResults() {
    const lastGuess = this.guessHistory[this.guessHistory.length - 1];
    const success = lastGuess && lastGuess.movie && lastGuess.char;
    const shareData = this.generateShareData(success);
    const shareText = shareData.text;

    // Try native share first if available (works on mobile with HTTPS)
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        if (err.name === 'AbortError') return; // User cancelled
        console.error('Share failed:', err);
        // Fall through to clipboard
      }
    }

    // Try modern clipboard API (works on HTTPS)
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(shareText);
        this.showCopiedFeedback();
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
        this.showCopiedFeedback();
        return;
      }
    } catch (err) {
      console.error('Textarea fallback failed:', err);
    }

    // Final fallback - show in alert for manual copy
    alert('Copy this to share:\n\n' + shareText);
  }

  showCopiedFeedback() {
    const btn = document.getElementById('share-btn');
    if (!btn) return;
    const original = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => btn.textContent = original, 2000);
  }
}
