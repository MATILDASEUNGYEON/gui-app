import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite는 server/index.ts에서 미들웨어 모드로 구동된다.
// 이 설정은 React 플러그인과 루트만 지정한다.
export default defineConfig({
  plugins: [react()]
});
