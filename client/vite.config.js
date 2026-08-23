import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const basePath = env.VITE_APP_BASE_PATH || '';
  return {
    base: basePath ? `${basePath.replace(/\/+$/, '')}/` : '/',
    appType: 'spa',
    plugins: [react()],
    server: {
      port: 5501,
      strictPort: true,
      host: '0.0.0.0'
    }
  };
});
