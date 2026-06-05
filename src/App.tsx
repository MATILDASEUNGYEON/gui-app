// import 화면 ↔ editor 화면을 상태로 전환한다.
import { useRef, useState } from 'react';
import ImportPanel from './components/ImportPanel';
import ProjectBar from './components/ProjectBar';
import StudioEditor from './components/StudioEditor';
import { saveToDisk } from './lib/editorSave';
import type { ProjectKind } from './lib/api';

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyEditor = any;

export default function App() {
  const [view, setView] = useState<'import' | 'editor'>('import');
  const [projectId, setProjectId] = useState<string>('');
  const [status, setStatus] = useState<string>('');

  // 현재 에디터 인스턴스 + kind (수동 저장에 사용)
  const ctxRef = useRef<{ editor: AnyEditor; kind: ProjectKind } | null>(null);

  function openProject(id: string) {
    ctxRef.current = null;
    setProjectId(id);
    setView('editor');
  }

  async function handleSave() {
    const ctx = ctxRef.current;
    if (!ctx?.editor || !projectId) return;
    setStatus(`${projectId} 저장 중...`);
    try {
      await saveToDisk(ctx.editor, projectId, ctx.kind);
      setStatus(`${projectId} 저장 완료`);
    } catch (e) {
      setStatus((e as Error).message);
    }
  }

  if (view === 'import') {
    return <ImportPanel onImported={openProject} />;
  }

  return (
    <div className="app">
      <ProjectBar
        currentId={projectId}
        status={status}
        onSelect={openProject}
        onSave={handleSave}
        onNewImport={() => setView('import')}
      />
      {/* key={projectId}로 프로젝트 전환 시 깨끗한 에디터 인스턴스를 보장한다. */}
      <StudioEditor
        key={projectId}
        projectId={projectId}
        onStatus={setStatus}
        onReady={(ctx) => {
          ctxRef.current = ctx;
        }}
      />
    </div>
  );
}
