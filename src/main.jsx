import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './auth/AuthContext.jsx';
import './index.css';

// StrictMode intentionally double-invokes effects in dev, which fires every
// data-fetch effect twice. Since this panel is run locally (npm run dev)
// against the live/prod backend, that meant two real API calls per navigation.
// Removed so dev matches production's single-call behavior.
createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <AuthProvider>
      <App />
    </AuthProvider>
  </BrowserRouter>,
);
