import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/global.css'; // includes SIGNAL design tokens + Geist @font-face declarations

const root = createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
