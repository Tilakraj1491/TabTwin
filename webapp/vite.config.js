// Configures Vite for the TabTwin guest web app.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    allowedHosts: ['tabtwinwebapp-production.up.railway.app']
  }
});
