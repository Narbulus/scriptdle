/**
 * GameDaily - Simplified game class for pre-generated daily puzzles
 * No RNG, no full script access - only the minimal puzzle data
 */
import { track } from '../utils/analytics.js';
import { Countdown } from './Countdown.js';
import { fireConfetti } from '../utils/confetti.js';
import { generateFlower, stringToSeed } from '../utils/flowerGenerator.js';
import { getStreak } from '../utils/completionTracker.js';
import { getCurrentDate } from '../utils/time.js';

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
    this.guessStats = [];

    // Modal cache
    this.packMoviesCache = null;
  }

  start() {
    track('game_start', { pack_id: this.pack.id, game_type: 'daily' });
    const savedProgress = this.loadProgress();
    if (savedProgress) {
      // Restore state
      this.gameOver = savedProgress.gameOver;
      this.win = savedProgress.win || (savedProgress.gameOver && savedProgress.success);
      this.currentAttempt = savedProgress.attempts;
      this.movieLocked = savedProgress.movieLocked || false;

      // Restore guess stats
      if (savedProgress.guessStats || savedProgress.guessHistory) {
        this.guessStats = savedProgress.guessStats || savedProgress.guessHistory;
      } else {
        // Backward compatibility - reconstruct from old format
        this.guessStats = this.reconstructGuessStats(savedProgress);
      }
    }

    // No target selection needed - puzzle is pre-determined
    this.render();
    this.bindEvents();

    // Enable transitions after initial render to prevent animation on load
    requestAnimationFrame(() => {
      const scriptArea = document.querySelector('.script-area');
      if (scriptArea) {
        scriptArea.classList.remove('no-transition');
      }
    });

    // Restore movie selector if needed
    if (savedProgress && savedProgress.selectedMovie) {
      const movieSelect = document.getElementById('movie-select');
      if (movieSelect) {
        movieSelect.value = savedProgress.selectedMovie;
        movieSelect.disabled = this.movieLocked;
        if (this.movieLocked) {
          movieSelect.parentElement.classList.add('correct');
        }
        this.onMovieChange();
      }
    }

    // If game is over, show completion UI after render completes
    if (savedProgress && savedProgress.gameOver) {
      // Use requestAnimationFrame to ensure DOM is fully painted
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            this.showCompletionUI(savedProgress.success, false);
          });
        });
      });
    }
  }

  showCompletionUI(success, isNewCompletion = false) {
    // Determine tier and message
    const attemptCount = this.guessStats.length;
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

    const tierMessage = this.manifest.tierMessages?.[tier] || (success ? 'Puzzle Completed!' : 'Game Over');

    // Generate flower/badge
    const today = getCurrentDate();
    const badgeSeed = stringToSeed(this.pack.id + today);
    const theme = this.packData?.theme || this.manifest.theme || {};
    const cardColor = theme.cardGradientStart || '#cccccc';

    let badgeHtml = '';
    if (success) {
      const flowerSvg = generateFlower(badgeSeed, cardColor);
      badgeHtml = `
        <div class="completion-badge-wrapper">
          <div class="completion-flower" style="background-image: url('${flowerSvg}');"></div>
        </div>`;

      // Fire confetti only on new completion
      if (isNewCompletion) {
        // Create confetti palette from theme
        const confettiColors = [
          theme.primary,
          theme.secondary,
          theme.accentColor,
          theme.cardGradientStart,
          theme.cardGradientEnd,
          '#ffffff' // Always add white for contrast
        ].filter(c => c); // Remove undefined/null

        // If we have at least 2 colors (white + one theme color), use them
        // Otherwise fallback to default rainbow (handled by passing null/undefined/empty to fireConfetti if we wanted, but here we just pass what we have if length > 1)
        fireConfetti(confettiColors.length > 1 ? confettiColors : null);
      }
    } else {
      const failEmojis = ['💀', '🙊', '🤡', '🤨', '🫣'];
      const emojiIndex = badgeSeed % failEmojis.length;
      const emoji = failEmojis[emojiIndex];
      badgeHtml = `<div class="completion-flower emoji-badge" style="display:flex; align-items:center; justify-content:center; font-size: 4rem;">${emoji}</div>`;
    }

    // Get stats
    const streak = getStreak();

    // Answer text
    const target = this.puzzle.targetLine;
    const answerText = `It was <strong>${target.character}</strong> in <br><em>${target.movie}</em>`;

    // Hide game message on completion
    const messageEl = document.getElementById('message');
    if (messageEl) messageEl.style.display = 'none';

    // Hide game controls and show new completion UI
    document.getElementById('game-controls').style.display = 'none';
    const shareContainer = document.getElementById('share-container');
    shareContainer.style.display = 'flex';

    // Inject new UI structure (compact - no countdown, already in footer)
    shareContainer.innerHTML = `
      <div class="completion-content">
        <div class="completion-header">
          <h2 class="completion-title">${tierMessage}</h2>
          <div class="completion-answer">${answerText}</div>
        </div>

        <div class="completion-row">
          <div class="stat-box">
            <div class="stat-value">${streak}</div>
            <div class="stat-label">Day Streak</div>
          </div>

          ${badgeHtml}

          <div class="stat-box">
            <div class="stat-value">${this.guessStats.length}/5</div>
            <div class="stat-label">Attempts</div>
          </div>
        </div>

        <div class="share-section">
          <button id="share-btn">Share Results</button>
          ${this.puzzle.imdbId
        ? `<a href="https://www.imdb.com/title/${this.puzzle.imdbId}/" target="_blank" rel="noopener noreferrer" class="movie-imdb-link">View on IMDB</a>`
        : ''}
          <a href="/" data-link class="footer-more-movies" style="margin-top: 1rem; font-size: 0.9rem;">Back to Menu</a>
        </div>
      </div>
    `;

    // Re-bind share button since we overwrote the innerHTML
    document.getElementById('share-btn').addEventListener('click', () => this.shareResults());
  }

  reconstructGuessStats(savedProgress) {
    // Reconstruct a minimal guess stats for rendering purposes
    const stats = [];
    const target = this.puzzle.targetLine;

    for (let i = 0; i < savedProgress.attempts; i++) {
      if (i === savedProgress.attempts - 1) {
        // Last guess - use actual success state
        stats.push({
          movie: savedProgress.success,
          char: savedProgress.success
        });
      } else {
        // Earlier guesses - assume they were wrong (for visual purposes only)
        stats.push({
          movie: false,
          char: false
        });
      }
    }

    return stats;
  }

  render() {
    const target = this.puzzle.targetLine;

    this.container.innerHTML = `
      <!-- Main Script Area - now starts at top -->
      <div class="script-area no-transition" data-theme="script">
        <div class="script-content">
          <!-- Script Lines -->
          <div id="script-display"></div>
        </div>
      </div>

      <!-- Footer with Controls -->
      <div class="game-footer">

        <div id="game-controls" ${this.gameOver ? 'style="display:none;"' : ''}>
          <!-- Pack Header Row - moved from top -->
          <div class="pack-header-row">
            ${this.pack.name.toUpperCase()} (<a id="movies-subtitle-link" class="pack-header-movies-link">${this.metadata.movies.length} MOVIES</a>)
          </div>

          <div class="footer-selectors">
            <div class="select-wrapper">
              <select id="movie-select">
                <option value="">Film</option>
                ${this.metadata.movies.map(m => {
      const title = this.metadata.movieTitles?.[m] || m;
      return `<option value="${m}">${title}</option>`;
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
          <div id="message" class="message-overlay" style="display: none;"></div>
        </div>
        
        <div id="other-packs-container"></div>

        <!-- Share Container (for completion UI) -->
        <div id="share-container" style="display: ${this.gameOver ? 'flex' : 'none'}; flex-direction: column; align-items: center; gap: 1rem;"></div>

        <!-- View Movies Modal -->
        <div id="movies-modal" class="modal-overlay" style="display: none;">
          <div class="modal-container">
            <div class="modal-header">
              <h2 class="modal-title">${this.pack.name}</h2>
              <button id="modal-close" class="modal-close-btn">&times;</button>
            </div>
            <div class="modal-content">
              <div id="movies-loading">Loading movies...</div>
              <div id="movies-list" style="display: none;"></div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.renderScript();
    this.renderOtherPacks();

    if (this.movieLocked) {
      const movieSelect = document.getElementById('movie-select');
      movieSelect.value = this.getMovieId(target.movie);
      movieSelect.disabled = true;
      movieSelect.parentElement.classList.add('correct');
    }
  }

  getMovieId(title) {
    if (!this.metadata.movies || !this.metadata.movieTitles) return title;

    // Find the ID that maps to this title
    const id = this.metadata.movies.find(m =>
      this.metadata.movieTitles[m] === title || m === title
    );

    return id || title;
  }

  renderScript() {
    const container = document.getElementById('script-display');
    container.innerHTML = '';

    // Update script area expansion based on attempts
    const scriptArea = document.querySelector('.script-area');
    if (scriptArea) {
      scriptArea.classList.remove('playing-0', 'expanded-1', 'expanded-2', 'expanded-full');
      // Clear any inline style overrides
      scriptArea.style.maxHeight = '';

      if (this.gameOver) {
        // Always show full script when game is over
        scriptArea.classList.add('expanded-full');
      } else if (this.currentAttempt >= 3) {
        scriptArea.classList.add('expanded-2');
      } else if (this.currentAttempt >= 1) {
        scriptArea.classList.add('expanded-1');
      } else {
        scriptArea.classList.add('playing-0');
      }
    }

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

    // Dynamically adjust script area height based on visible quotes
    if (scriptArea) {
      requestAnimationFrame(() => {
        const allLines = container.querySelectorAll('.script-line');
        const padding = 32; // Extra padding for visual breathing room

        let targetHeight = 0;

        if (this.currentAttempt === 0) {
          // Show only first quote
          if (allLines[0]) {
            targetHeight = allLines[0].offsetHeight + padding;
          }
        } else if (this.currentAttempt >= 1 && this.currentAttempt < 3) {
          // Show first + second quote (bottom of 2nd quote)
          if (allLines[0] && allLines[1]) {
            targetHeight = allLines[0].offsetHeight + allLines[1].offsetHeight + padding;
          }
        } else if (this.currentAttempt >= 3) {
          // Show first + second + third quote (bottom of 3rd quote)
          if (allLines[0] && allLines[1] && allLines[2]) {
            targetHeight = allLines[0].offsetHeight + allLines[1].offsetHeight + allLines[2].offsetHeight + padding;
          }
        }

        if (targetHeight > 0) {
          scriptArea.style.maxHeight = `${targetHeight}px`;
        }
      });
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

    // View Movies modal - subtitle link
    const moviesSubtitleLink = document.getElementById('movies-subtitle-link');
    if (moviesSubtitleLink) {
      moviesSubtitleLink.addEventListener('click', (e) => {
        e.preventDefault();
        this.openMoviesModal();
      });
    }

    // Modal close button
    const modalClose = document.getElementById('modal-close');
    if (modalClose) {
      modalClose.addEventListener('click', () => this.closeMoviesModal());
    }

    // Close on overlay click
    const modalOverlay = document.getElementById('movies-modal');
    if (modalOverlay) {
      modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
          this.closeMoviesModal();
        }
      });
    }

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const modal = document.getElementById('movies-modal');
        if (modal && modal.style.display === 'flex') {
          this.closeMoviesModal();
        }
      }
    });
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

    // Clear any previous game messages (like "Incorrect")
    const messageEl = document.getElementById('message');
    if (messageEl) messageEl.style.display = 'none';

    let movieGuessTitle = movieGuess;

    // Resolve ID to title if available
    if (this.metadata.movieTitles && this.metadata.movieTitles[movieGuess]) {
      movieGuessTitle = this.metadata.movieTitles[movieGuess];
    }

    const target = this.puzzle.targetLine;

    // Check against both title (primary) and ID (fallback)
    const movieCorrect = movieGuessTitle === target.movie || movieGuess === target.movie;
    const charCorrect = charGuess.toUpperCase() === target.character.toUpperCase();

    this.guessStats.push({ movie: movieCorrect, char: charCorrect });

    if (movieCorrect) {
      this.movieLocked = true;
      movieSelect.disabled = true;
      movieSelect.parentElement.classList.add('correct');
    } else if (!this.movieLocked) {
      movieSelect.value = '';
      this.onMovieChange();
    }

    if (movieCorrect && charCorrect) {
      // Don't show success message for win - go straight to completion UI
      this.gameOver = true;
      this.win = true;
      this.saveProgress();
      this.renderScript();
      this.showCompletionUI(true, true);
    } else {
      this.currentAttempt++;
      document.getElementById('attempt-count').textContent = this.currentAttempt;

      if (this.currentAttempt >= 5) {
        this.showMessage(`Game Over! It was ${target.character} in ${target.movie}.`, 'error');
        this.gameOver = true;
        this.saveProgress();
        this.renderScript();
        this.showCompletionUI(false);
      } else {
        let msg = 'Incorrect.';
        if (movieCorrect) msg = 'Movie is correct! Character is wrong.';
        this.showMessage(msg + ' New clue revealed!', 'error');
        // Save progress after each guess
        this.saveProgress();
        this.renderScript();
        if (this.movieLocked) {
          document.getElementById('movie-select').value = this.getMovieId(target.movie);
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

    // Clear any existing fade timeout
    if (this.messageTimeout) {
      clearTimeout(this.messageTimeout);
    }
    if (this.messageFadeTimeout) {
      clearTimeout(this.messageFadeTimeout);
    }

    // Reset state and show message
    el.classList.remove('fading');
    el.textContent = msg;
    el.className = 'message-overlay ' + type;
    el.style.display = 'block';

    // Auto-fade after 3 seconds
    this.messageTimeout = setTimeout(() => {
      el.classList.add('fading');

      // Hide after fade animation completes (500ms transition)
      this.messageFadeTimeout = setTimeout(() => {
        el.style.display = 'none';
        el.classList.remove('fading');
      }, 500);
    }, 3000);
  }

  generateShareString(success) {
    // Use dash instead of colon - iOS interprets colon as URL scheme and encodes everything
    let grid = `Scriptle - ${this.pack.name}\n\n`;

    let movieRow = '';
    let charRow = '';

    for (let i = 0; i < 5; i++) {
      if (i < this.guessStats.length) {
        const guess = this.guessStats[i];
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
    const url = window.location.href;
    return {
      text: text + '\n\n' + url
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
    const attemptCount = this.guessStats.length;
    const success = this.guessStats[this.guessStats.length - 1]?.movie &&
      this.guessStats[this.guessStats.length - 1]?.char;

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
    const lastGuess = this.guessStats[this.guessStats.length - 1];
    const success = lastGuess?.movie && lastGuess?.char;

    // Get selected movie for restoring dropdown
    const movieSelect = document.getElementById('movie-select');
    const selectedMovie = movieSelect ? movieSelect.value : null;

    const data = {
      v: STORAGE_VERSION,
      attempts: this.guessStats.length,  // Actual number of attempts, not index
      success: this.gameOver ? success : null,
      win: this.win,
      gameOver: this.gameOver,
      guessStats: this.guessStats,
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
    const lastGuess = this.guessStats[this.guessStats.length - 1];
    const success = lastGuess && lastGuess.movie && lastGuess.char;
    const shareData = this.generateShareData(success);
    const shareText = shareData.text;

    // Detect mobile devices
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    // On mobile, use native share sheet; on desktop, copy to clipboard
    if (isMobile && navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        if (err.name === 'AbortError') return; // User cancelled
        console.error('Share failed:', err);
        // Fall through to clipboard
      }
    }

    // Copy to clipboard (desktop or mobile fallback)
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(shareText);
        this.showCopiedFeedback();
        return;
      } catch (err) {
        console.error('Clipboard API failed:', err);
      }
    }

    // Final fallback - show in alert
    alert('Copy this to share:\n\n' + shareText);
  }

  showCopiedFeedback() {
    const btn = document.getElementById('share-btn');
    if (!btn) return;
    const original = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => btn.textContent = original, 2000);
  }

  // Modal methods

  async fetchPackMovies() {
    if (this.packMoviesCache) {
      return this.packMoviesCache;
    }

    const moviesList = [];

    for (const movieId of this.packData.movies) {
      try {
        const response = await fetch(`/data/scripts/${movieId}.json`);
        const script = await response.json();

        moviesList.push({
          id: movieId,
          title: script.title,
          year: script.year,
          imdbId: script.imdbId,
          poster: script.poster
        });
      } catch (e) {
        console.error(`Failed to load movie ${movieId}:`, e);
      }
    }

    this.packMoviesCache = moviesList;
    return moviesList;
  }

  renderMoviesList(movies) {
    const listContainer = document.getElementById('movies-list');

    listContainer.innerHTML = movies.map(movie => {
      const mainUrl = movie.imdbId
        ? `https://www.imdb.com/title/${movie.imdbId}/`
        : null;
      const castUrl = movie.imdbId
        ? `https://www.imdb.com/title/${movie.imdbId}/fullcredits/?ref_=tt_cst_sm`
        : null;

      return `
        <div class="movie-item">
          ${movie.poster && movie.poster !== 'N/A'
          ? `<img src="${movie.poster}" alt="${movie.title}" class="movie-poster-thumb">`
          : `<div class="movie-poster-placeholder"></div>`
        }
          <div class="movie-info">
            <div class="movie-title">${movie.title}</div>
            <div class="movie-links">
              ${mainUrl
          ? `<a href="${mainUrl}" target="_blank" rel="noopener noreferrer" class="movie-imdb-link">
                     Details
                   </a>`
          : `<span class="movie-no-link">IMDB unavailable</span>`
        }
              ${castUrl
          ? `<a href="${castUrl}" target="_blank" rel="noopener noreferrer" class="movie-imdb-link">
                     Cast
                   </a>`
          : ``
        }
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  async openMoviesModal() {
    const modal = document.getElementById('movies-modal');
    const loading = document.getElementById('movies-loading');
    const list = document.getElementById('movies-list');

    // Update modal title
    const title = document.querySelector('.modal-title');
    title.textContent = this.pack.name;

    // Show modal
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // Load movies
    loading.style.display = 'block';
    list.style.display = 'none';

    try {
      const movies = await this.fetchPackMovies();
      this.renderMoviesList(movies);
      loading.style.display = 'none';
      list.style.display = 'block';
    } catch (e) {
      loading.textContent = 'Error loading movies';
      console.error('Failed to load pack movies:', e);
    }
  }

  closeMoviesModal() {
    const modal = document.getElementById('movies-modal');
    modal.style.display = 'none';
    document.body.style.overflow = '';
  }
}
