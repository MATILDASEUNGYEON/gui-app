// 서버 API 호출 헬퍼 (GUI-test/src/main.js의 apiGet/apiPost 포팅).

export async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || `GET ${url} failed`);
  }
  return res.json() as Promise<T>;
}

export async function apiPost<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || `POST ${url} failed`);
  }
  return res.json() as Promise<T>;
}

export interface ProjectInfo {
  id: string;
  name: string;
}

export type ProjectKind = 'screens' | 'html';

export interface ProjectResponse {
  kind: ProjectKind;
  screens?: { id: string; title?: string }[];
  project: { pages: { name: string; component: string }[] };
}

export interface ImportResponse {
  id: string;
  kind: ProjectKind;
  isScreens: boolean;
  flattened: boolean;
}
