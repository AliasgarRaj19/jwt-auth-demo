import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  appType: 'spa',
  plugins: [react()],
  server: {
    port: 5501,
    strictPort: true,
    host: '0.0.0.0'
  }
});
