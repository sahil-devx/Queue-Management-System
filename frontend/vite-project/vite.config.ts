import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('react') || id.includes('react-dom')) {
            return 'vendor';
          }
          if (id.includes('react-router')) {
            return 'router';
          }
          if (id.includes('framer-motion') || id.includes('lucide-react')) {
            return 'ui';
          }
        }
      }
    }
  },
  server: {
    port: 5173
  }
});

