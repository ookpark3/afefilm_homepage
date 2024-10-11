import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '/'),
    },
  },
  build: {
    assetsInlineLimit: 0,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'), // 리디렉션용 페이지
        kr: path.resolve(__dirname, 'kr/index.html'), // 한국어 메인 페이지
        // en: path.resolve(__dirname, 'en/index.html'), // 영어 메인 페이지
        work: path.resolve(__dirname, 'kr/work.html'), // 한국어 워크 페이지
        about: path.resolve(__dirname, 'kr/about.html'), // 한국어 어바웃 페이지
        contact: path.resolve(__dirname, 'kr/contact.html'), // 한국어 연락처 페이지
        404: path.resolve(__dirname, '404.html'), // 404 페이지
      },
      output: {
        assetFileNames: (assetInfo) => {
          if (assetInfo.name.endsWith('.woff2')) {
            return 'assets/fonts/[name][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
      },
    },
  },
  server: {
    hmr: true,
  },
  publicDir: 'public',
  css: {
    postcss: {
      plugins: [
        {
          postcssPlugin: 'internal:charset-removal',
          AtRule: {
            charset: (atRule) => {
              if (atRule.name === 'charset') {
                atRule.remove();
              }
            },
          },
        },
      ],
    },
  },
});
