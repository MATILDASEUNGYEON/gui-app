// 에디터 상단바: 프로젝트 선택 / 저장 / 내보내기 / 상태 표시.
import { useEffect, useState } from 'react';
import { apiGet } from '../lib/api';
import type { ProjectInfo } from '../lib/api';

interface Props {
  currentId: string;
  status: string;
  onSelect: (id: string) => void;
  onSave: () => void;
  onNewImport: () => void;
}

export default function ProjectBar({
  currentId,
  status,
  onSelect,
  onSave,
  onNewImport
}: Props) {
  const [projects, setProjects] = useState<ProjectInfo[]>([]);

  useEffect(() => {
    apiGet<{ projects: ProjectInfo[] }>('/api/projects')
      .then((d) => setProjects(d.projects))
      .catch(() => setProjects([]));
  }, [currentId]);

  return (
    <header className="topbar">
      <strong>와이어프레임 GUI 스튜디오</strong>

      <select value={currentId} onChange={(e) => onSelect(e.target.value)}>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      <button type="button" onClick={onSave}>
        저장
      </button>

      <a
        className="btn-link"
        href={`/api/projects/${encodeURIComponent(currentId)}/download`}
        download
      >
        내보내기(.html)
      </a>

      <button type="button" onClick={onNewImport}>
        새로 가져오기
      </button>

      <span className="status">{status}</span>
    </header>
  );
}
