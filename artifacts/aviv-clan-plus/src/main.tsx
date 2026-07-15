import { createRoot } from 'react-dom/client';
import { setBaseUrl } from '@workspace/api-client-react';

import App from './App';

import './index.css';

// On Replit, the frontend and API share one domain via path-based routing,
// so relative "/api/..." calls just work. When deployed standalone (e.g. on
// Koyeb), the frontend and API are separate services with separate URLs, so
// VITE_API_URL must be set at build time to the API's public origin
// (e.g. https://aviv-clan-api.koyeb.app) — no trailing "/api", the client
// already includes that prefix in its generated paths.
const apiUrl = import.meta.env.VITE_API_URL;
if (apiUrl) {
  setBaseUrl(apiUrl);
}

createRoot(document.getElementById('root')!).render(<App />);
