import { createRoot } from 'react-dom/client';
import App from './App';
import './style.css';

// StrictMode 미사용: GrapesJS 에디터의 이중 init(개발 모드 effect 2회 실행)을 피한다.
createRoot(document.getElementById('root')!).render(<App />);
