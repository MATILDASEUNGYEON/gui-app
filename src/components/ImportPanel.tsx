// 외부에서 만든 와이어프레임 .html을 붙여넣기 또는 파일 첨부로 받아 가져온다.
import { useRef, useState } from 'react';
import { apiPost } from '../lib/api';
import type { ImportResponse } from '../lib/api';

interface Props {
  onImported: (id: string) => void;
}

export default function ImportPanel({ onImported }: Props) {
  const [name, setName] = useState('');
  const [html, setHtml] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const detected = /const\s+SCREENS\s*=/.test(html);

  function pickFile(file: File | undefined) {
    if (!file) return;
    if (!name.trim()) setName(file.name.replace(/\.html?$/i, ''));
    const reader = new FileReader();
    reader.onload = () => setHtml(String(reader.result ?? ''));
    reader.onerror = () => setError('파일을 읽지 못했습니다.');
    reader.readAsText(file);
  }

  async function start() {
    setError('');
    if (!html.trim()) {
      setError('와이어프레임 HTML 코드를 붙여넣거나 .html 파일을 첨부하세요.');
      return;
    }
    setBusy(true);
    try {
      const res = await apiPost<ImportResponse>('/api/projects/import', {
        name: name.trim(),
        html
      });
      onImported(res.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="import-wrap">
      <div className="import-card">
        <h1>와이어프레임 가져오기</h1>
        <p className="sub">
          외부(예: Claude Desktop)에서 만든 와이어프레임 <code>.html</code> 코드를
          붙여넣거나 파일을 첨부하면 GUI로 편집할 수 있습니다.
        </p>

        <label className="field">
          <span>프로젝트 이름</span>
          <input
            type="text"
            value={name}
            placeholder="예: 회원 콘솔 화면설계서"
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <div className="field">
          <div className="field-head">
            <span>HTML 코드</span>
            <div className="field-actions">
              {html && (
                <span className={`badge ${detected ? 'ok' : 'warn'}`}>
                  {detected ? 'SCREENS 와이어프레임 감지됨' : '일반 HTML (단일 페이지)'}
                </span>
              )}
              <button
                type="button"
                className="link-btn"
                onClick={() => fileRef.current?.click()}
              >
                .html 파일 첨부
              </button>
              {html && (
                <button type="button" className="link-btn" onClick={() => setHtml('')}>
                  지우기
                </button>
              )}
            </div>
          </div>
          <textarea
            value={html}
            placeholder="<!doctype html> ... 여기에 와이어프레임 .html 코드를 붙여넣으세요"
            spellCheck={false}
            onChange={(e) => setHtml(e.target.value)}
          />
          <input
            ref={fileRef}
            type="file"
            accept=".html,text/html"
            style={{ display: 'none' }}
            onChange={(e) => pickFile(e.target.files?.[0])}
          />
        </div>

        {error && <div className="error">{error}</div>}

        <button type="button" className="primary" disabled={busy} onClick={start}>
          {busy ? '가져오는 중...' : '편집 시작'}
        </button>
      </div>
    </div>
  );
}
