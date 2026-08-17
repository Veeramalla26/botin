import React from 'react';
import ReactDOM from 'react-dom/client';
import App, { FloatWindowApp } from './App';
import './index.css';

const isFloat = new URLSearchParams(window.location.search).get('float') === '1';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isFloat ? <FloatWindowApp /> : <App />}
  </React.StrictMode>
);
