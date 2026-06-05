// 편집 결과를 디스크에 반영한다. (GUI-test/src/main.js의 saveToDisk 포팅)
// id 기반으로 동작하도록 수정. editor 타입은 SDK 의존을 피해 느슨하게 둔다.
import { apiPost } from './api';
import type { ProjectKind } from './api';

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyEditor = any;

export async function saveToDisk(
  ed: AnyEditor,
  id: string,
  kind: ProjectKind
): Promise<void> {
  if (!ed || !id) return;

  if (kind === 'screens') {
    const pages = ed.Pages.getAll().map((page: AnyEditor) => ({
      // 페이지 이름 = 화면 id (서버 로드 시 그렇게 지정함)
      id: page.getName() || page.getId(),
      html: ed.getHtml({ component: page.getMainComponent() })
    }));

    await apiPost('/api/export-html', { id, pages });
    return;
  }

  // 일반 HTML: 단일 페이지를 전체 문서로 재조립
  const page = ed.Pages.getAll()[0] ?? ed.Pages.getSelected();
  const component = page ? page.getMainComponent() : undefined;

  const bodyHtml = ed.getHtml(component ? { component } : undefined);
  const css = ed.getCss(component ? { component } : undefined) || '';

  const doc = `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>${css}</style>
  </head>
  <body>${bodyHtml}</body>
</html>
`;

  await apiPost('/api/export-html', { id, html: doc });
}
