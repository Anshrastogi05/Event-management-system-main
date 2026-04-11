import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './tailwind.css'
import axios from 'axios'

axios.defaults.baseURL = '' // same origin proxy

// Ensure theme is applied immediately on app bootstrap
function applyThemeFromStorage() {
  try {
    const theme = localStorage.getItem('theme') || 'light';
    const root = document.documentElement;
    const body = document.body;
    const isDark = theme === 'dark';

    root.classList.toggle('dark', isDark);
    body && body.classList.toggle('dark', isDark);
    localStorage.setItem('theme', theme);

    // expose for debugging
    window.theme = {
      get: () => localStorage.getItem('theme'),
      set: (next) => { localStorage.setItem('theme', next); applyThemeFromStorage(); }
    };
  } catch (_) {}
}

applyThemeFromStorage();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
