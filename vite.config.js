import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

export default defineConfig({
  plugins: [
    react(),
  ],
  css: {
    postcss: {
      plugins: [
        tailwindcss(),
        autoprefixer(),
      ],
    },
  },
  server: {
    proxy: {
      // Проксируем все запросы /api/* на ваш Express‑сервер на порту 3000
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom']
        }
      }
    },
    // Оптимизация для продакшена
    minify: 'esbuild',
    target: 'es2015'
  },
  // Базовый путь для статических файлов
  base: '/',
  // Настройки для предварительного просмотра
  preview: {
    port: 4173,
    strictPort: true
  }
});