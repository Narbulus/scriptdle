/**
 * Modal - Reusable modal component
 *
 * Usage:
 *   const modal = new Modal('My Title');
 *   modal.setContent('<div>Custom content here</div>');
 *   modal.open();
 */

export class Modal {
  constructor(title = '') {
    this.title = title;
    this.content = '';
    this.modalId = `modal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.isOpen = false;
    this.onCloseCallback = null;

    this.render();
    this.bindEvents();
  }

  render() {
    // Check if modal already exists in DOM
    let existingModal = document.getElementById(this.modalId);
    if (existingModal) {
      existingModal.remove();
    }

    // Create modal HTML
    const modalHTML = `
      <div id="${this.modalId}" class="modal-overlay" style="display: none;">
        <div class="modal-container">
          <div class="modal-header">
            <h2 class="modal-title">${this.title}</h2>
            <button class="modal-close-btn" data-modal-close>&times;</button>
          </div>
          <div class="modal-content">
            <div class="modal-body">
              ${this.content}
            </div>
          </div>
        </div>
      </div>
    `;

    // Append to body
    document.body.insertAdjacentHTML('beforeend', modalHTML);
  }

  bindEvents() {
    const modal = document.getElementById(this.modalId);
    if (!modal) return;

    // Close button
    const closeBtn = modal.querySelector('[data-modal-close]');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }

    // Close on overlay click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        this.close();
      }
    });

    // Close on Escape key
    this.escapeHandler = (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    };
    document.addEventListener('keydown', this.escapeHandler);
  }

  setTitle(title) {
    this.title = title;
    const modal = document.getElementById(this.modalId);
    if (modal) {
      const titleEl = modal.querySelector('.modal-title');
      if (titleEl) titleEl.textContent = title;
    }
  }

  setContent(content) {
    this.content = content;
    const modal = document.getElementById(this.modalId);
    if (modal) {
      const contentEl = modal.querySelector('.modal-body');
      if (contentEl) contentEl.innerHTML = content;
    }
  }

  open() {
    const modal = document.getElementById(this.modalId);
    if (modal) {
      modal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
      this.isOpen = true;
    }
  }

  close() {
    const modal = document.getElementById(this.modalId);
    if (modal) {
      modal.style.display = 'none';
      document.body.style.overflow = '';
      this.isOpen = false;

      if (this.onCloseCallback) {
        this.onCloseCallback();
      }
    }
  }

  onClose(callback) {
    this.onCloseCallback = callback;
  }

  destroy() {
    const modal = document.getElementById(this.modalId);
    if (modal) {
      modal.remove();
    }

    if (this.escapeHandler) {
      document.removeEventListener('keydown', this.escapeHandler);
    }
  }
}
