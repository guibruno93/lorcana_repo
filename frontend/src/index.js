import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './InkwellApp';
import './index.css';
import './i18n';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

if (
  process.env.NODE_ENV === 'production' &&
  'serviceWorker' in navigator &&
  typeof window !== 'undefined'
) {
  window.addEventListener('load', () => {
    const base = (process.env.PUBLIC_URL || '').replace(/\/$/, '');
    navigator.serviceWorker
      .register(`${base}/sw.js`)
      .catch(() => {});
  });
}