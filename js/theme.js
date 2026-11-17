// Light/Dark mode toggle persisted across pages

const THEME_KEY = 'ai_theme';

function applyTheme(theme) {
  const t = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-bs-theme', t);
  const btn = document.getElementById('themeToggle');
  if (btn) {
    btn.textContent = t === 'dark' ? '☀️' : '🌙';
    btn.setAttribute('aria-label', t === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    btn.title = t === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  }
  localStorage.setItem(THEME_KEY, t);
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY) || 
    (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  applyTheme(saved);
  const btn = document.getElementById('themeToggle');
  if (btn) {
    btn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-bs-theme');
      applyTheme(current === 'dark' ? 'light' : 'dark');
    });
  }
}

// Early theme check to prevent FOUC
try {
  const earlyTheme = localStorage.getItem(THEME_KEY) || 
    (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.setAttribute('data-bs-theme', earlyTheme);
} catch (e) {
  // Local storage access error fallback
}

document.addEventListener('DOMContentLoaded', initTheme);