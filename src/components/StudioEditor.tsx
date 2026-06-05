// GrapesJS Studio SDK를 React로 래핑. (GUI-test/src/main.js의 initEditor 포팅)
import { useEffect, useRef, useState } from 'react';
import createStudioEditor from '@grapesjs/studio-sdk';
import '@grapesjs/studio-sdk/style';
import { apiGet } from '../lib/api';
import type { ProjectResponse, ProjectKind } from '../lib/api';
import { saveToDisk } from '../lib/editorSave';

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyEditor = any;

interface Props {
  projectId: string;
  onStatus?: (msg: string) => void;
  onReady?: (ctx: { editor: AnyEditor; kind: ProjectKind }) => void;
}

export default function StudioEditor({ projectId, onStatus, onReady }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  // 최신 콜백을 effect 재실행 없이 참조하기 위한 ref
  const cbRef = useRef({ onStatus, onReady });
  cbRef.current = { onStatus, onReady };

  useEffect(() => {
    let disposed = false;
    let editor: AnyEditor = null;
    setError('');

    (async () => {
      cbRef.current.onStatus?.(`${projectId} 로딩 중...`);

      const data = await apiGet<ProjectResponse>(
        `/api/project?id=${encodeURIComponent(projectId)}`
      );
      if (disposed || !rootRef.current) return;

      const kind: ProjectKind = data.kind || 'html';

      await createStudioEditor({
        root: rootRef.current,
        // localhost에서는 비어있지 않은 아무 키나 유효(SDK 사양). 빈 문자열은
        // '잘못된 키'로 처리돼 License Error가 나므로 DEV_LICENSE_KEY로 폴백한다.
        // 외부 도메인/IP로 배포할 때는 VITE_GRAPESJS_LICENSE_KEY에 실제 키를 넣어야 한다.
        licenseKey: import.meta.env.VITE_GRAPESJS_LICENSE_KEY || 'DEV_LICENSE_KEY',
        project: { type: 'web' },

        onEditor: (ed: AnyEditor) => {
          editor = ed;
          cbRef.current.onReady?.({ editor: ed, kind });
        },

        storage: {
          type: 'self',
          autosaveChanges: 10,
          autosaveIntervalMs: 10000,

          onLoad: async () => ({ project: data.project }),

          onSave: async ({ editor: ed }: { editor: AnyEditor }) => {
            await saveToDisk(ed ?? editor, projectId, kind);
            cbRef.current.onStatus?.(
              kind === 'screens'
                ? `${projectId} SCREENS 반영 완료`
                : `${projectId} HTML 반영 완료`
            );
          }
        }
      });

      if (disposed) {
        // 생성 완료 전에 언마운트됨 → 누수 방지를 위해 즉시 파기
        try {
          editor?.destroy?.();
        } catch {
          /* noop */
        }
        return;
      }
      cbRef.current.onStatus?.(
        kind === 'screens'
          ? `${projectId} 편집 준비 완료 — 좌측 페이지 목록에서 화면을 전환하세요`
          : `${projectId} 편집 준비 완료`
      );
    })().catch((err: Error) => {
      console.error(err);
      if (disposed) return;
      setError(err.message);
      cbRef.current.onStatus?.(err.message);
    });

    return () => {
      disposed = true;
      try {
        editor?.destroy?.();
      } catch {
        /* noop */
      }
    };
  }, [projectId]);

  if (error) {
    return (
      <div className="editor-error">
        <div className="editor-error-card">
          <h2>이 파일은 GUI로 열 수 없습니다</h2>
          <p>{error}</p>
          <p className="hint">
            상단 「새로 가져오기」로 다른 와이어프레임을 불러오거나, 정적 본문
            형식(<code>body: `...html...`</code>)의 파일을 사용하세요.
          </p>
        </div>
      </div>
    );
  }

  return <div ref={rootRef} style={{ flex: 1, minHeight: 0 }} />;
}
