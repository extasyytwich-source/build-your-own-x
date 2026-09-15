import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import { LiveUpdatesProvider } from './context/LiveUpdatesContext.jsx';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ToastProvider>
      <AuthProvider>
        <LiveUpdatesProvider>
          <App />
        </LiveUpdatesProvider>
      </AuthProvider>
    </ToastProvider>
  </React.StrictMode>
);
