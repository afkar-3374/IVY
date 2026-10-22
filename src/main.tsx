import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { setupPwaUpdates } from './services/pwaUpdate';
import { setupAndroidNavBar } from './utils/androidNavBar';

setupAndroidNavBar();
setupPwaUpdates();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
