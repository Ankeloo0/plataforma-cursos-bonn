import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Fuentes servidas desde el propio servidor, nunca desde Google Fonts (design-reference.md 6.1).
import '@fontsource-variable/figtree';
import '@fontsource/spectral/500.css';
import App from './App';
import { useAuthStore } from './features/auth/stores/auth.store';
import './styles/global.css';

// Se pregunta a la API si la cookie de sesion sigue valida antes de decidir que pantalla mostrar
void useAuthStore.getState().verificarSesion();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
