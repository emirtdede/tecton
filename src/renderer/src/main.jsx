import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import './index.css';
import './i18n';
import { bootstrapAppearance } from './theme/appearance';

// Apply cached theme/zoom before the first React paint so there is no flash of
// the default palette on launch.
bootstrapAppearance();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
