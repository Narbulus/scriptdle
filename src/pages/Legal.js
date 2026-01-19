import { Navigation } from '../components/Navigation.js';

export function renderLegal({ navContainer, contentContainer }) {
    // Render nav bar
    navContainer.innerHTML = '';
    const nav = Navigation({ showBackButton: true });
    navContainer.appendChild(nav);

    // Render content
    contentContainer.innerHTML = `
    <div class="legal-container" style="max-width: 800px; margin: 0 auto; padding: 2rem; font-family: sans-serif; line-height: 1.6;">
      <h1>Legal Information</h1>
      
      <section style="margin-bottom: 3rem;">
        <h2>Privacy Policy</h2>
        <p>Last updated: January 2026</p>
        <p>Scriptle ("we", "our", or "us") operates the Scriptle daily movie quote game. This page informs you of our policies regarding the collection, use, and disclosure of personal data when you use our Service and the choices you have associated with that data.</p>
        <p><strong>Information Collection:</strong> We do not collect any personal identifiable information (PII). Game progress and statistics are stored locally on your device using LocalStorage.</p>
        <p><strong>Cookies:</strong> We use local storage to save your game progress. We may use third-party analytics services (like Google Analytics) which may use cookies to gather anonymous usage data to help us improve the game.</p>
      </section>

      <section style="margin-bottom: 3rem;">
        <h2>Terms of Service</h2>
        <p>By accessing Scriptle, you agree to be bound by these Terms of Service.</p>
        <p><strong>Usage:</strong> You are granted a limited license to access and use the Service for personal entertainment purposes.</p>
        <p><strong>Content:</strong> All movie quotes and related content are property of their respective owners and appear here under Fair Use principles for educational/trivia purposes.</p>
        <p><strong>Disclaimer:</strong> The Service is provided "AS IS" without royalties or warranties of any kind.</p>
      </section>
      
      <div style="text-align: center; margin-top: 4rem; color: #666; font-size: 0.9rem;">
        &copy; 2026 Scriptle. All rights reserved.
      </div>
    </div>
  `;
}
