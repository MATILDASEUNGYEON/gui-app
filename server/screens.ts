/*
  screen-design.html 류 SPA 지원 모듈. (GUI-test/screens.mjs 포팅)

  이 파일들은 화면 내용을 정적 DOM이 아니라 <script> 안의
  `const SCREENS = [{ ..., body: `<html>` }, ...]` 데이터로 들고 있어
  GrapesJS가 직접 편집할 수 없다.

  전략:
  - 로드 시   : SCREENS 각 항목의 body(HTML 조각)를 꺼내 GrapesJS '페이지'로 펼친다.
  - 저장 시   : 편집된 각 페이지 HTML을 원래 SCREENS[i].body 템플릿 리터럴 자리에
                다시 끼워 넣는다. 렌더링 엔진/네비게이션/기타 필드는 그대로 보존된다.
*/

export interface Screen {
  id: string;
  group?: string;
  title?: string;
  purpose?: string;
  body?: string;
  [key: string]: unknown;
}

export function isScreensFile(html: string): boolean {
  return /const\s+SCREENS\s*=/.test(html);
}

// 첫 번째 <style> 블록 내용(디자인 시스템 CSS)을 추출한다. 없으면 ''.
export function extractStyleCss(html: string): string {
  const m = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  return m ? m[1] : '';
}

// SCREENS 정적 평가가 외부 함수 참조(예: body:chrome(...)) 때문에 실패할 때 던지는 오류.
export class DynamicBodiesError extends Error {
  constructor(detail: string) {
    super(
      '이 파일은 화면 본문을 JavaScript 함수로 동적 생성합니다(예: body: chrome(...)). ' +
        '현재 GUI 편집기는 정적 본문(body: `...html...`) 형식의 SCREENS만 지원합니다. ' +
        `(상세: ${detail})`
    );
    this.name = 'DynamicBodiesError';
  }
}

/*
  `const SCREENS = [ ... ]`(배열) 또는 `const SCREENS = { ... }`(객체 맵) 리터럴의
  정확한 경계를 찾아 원문을 반환한다. 문자열/템플릿 리터럴 안의 괄호는 무시한다.
*/
function extractScreensLiteral(html: string): string | null {
  const marker = html.match(/const\s+SCREENS\s*=\s*/);
  if (!marker || marker.index === undefined) return null;

  let i = marker.index + marker[0].length;
  const open = html[i];
  if (open !== '[' && open !== '{') return null;
  const close = open === '[' ? ']' : '}';

  const start = i;
  let depth = 0;
  let str: string | null = null; // 현재 열린 따옴표 종류 (' " `) 또는 null
  let esc = false;

  for (; i < html.length; i++) {
    const c = html[i];

    if (str) {
      if (esc) {
        esc = false;
      } else if (c === '\\') {
        esc = true;
      } else if (c === str) {
        str = null;
      }
      continue;
    }

    if (c === '"' || c === "'" || c === '`') {
      str = c;
      continue;
    }

    if (c === open) {
      depth++;
    } else if (c === close) {
      depth--;
      if (depth === 0) {
        return html.slice(start, i + 1);
      }
    }
  }

  return null;
}

/*
  SCREENS를 실제 JS 값으로 materialize 한 뒤 화면 배열로 정규화한다.
  - 배열 형식: 각 항목이 곧 화면 (id 필드 보유)
  - 객체 맵 형식: { ID: {...} } → [{ id: ID, ... }]
  본문이 정적 문자열이 아니라 함수 호출(chrome(...) 등)이면 평가가 실패하므로
  DynamicBodiesError로 명확히 알린다.
*/
export function extractScreens(html: string): Screen[] {
  const literal = extractScreensLiteral(html);
  if (!literal) {
    throw new Error('SCREENS 정의(배열 또는 객체)를 찾지 못했습니다.');
  }

  let value: unknown;
  try {
    // eslint-disable-next-line no-new-func
    value = new Function(`return (${literal});`)();
  } catch (e) {
    // 대개 "<helper> is not defined" — 동적 본문 생성 패턴.
    throw new DynamicBodiesError((e as Error).message);
  }

  if (Array.isArray(value)) {
    return value as Screen[];
  }

  if (value && typeof value === 'object') {
    // 객체 맵: 키 = 화면 id (삽입 순서 보존)
    return Object.entries(value as Record<string, Omit<Screen, 'id'>>).map(
      ([id, v]) => ({ id, ...(v as object) }) as Screen
    );
  }

  throw new Error('SCREENS가 배열도 객체도 아닙니다.');
}

function escapeForTemplate(s: string): string {
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${');
}

/*
  편집된 body HTML들을 원래 파일의 `body: `...`` 자리에 순서대로 다시 끼워 넣는다.
  orderedHtmls[i]는 SCREENS 배열의 i번째 화면에 대응한다.
*/
export function reinjectBodies(html: string, orderedHtmls: string[]): string {
  let idx = 0;

  const re = /body:\s*`[\s\S]*?`/g;
  const out = html.replace(re, (match) => {
    if (idx >= orderedHtmls.length) return match;
    const content = escapeForTemplate(orderedHtmls[idx]);
    idx++;
    return `body: \`\n${content}\n    \``;
  });

  if (idx !== orderedHtmls.length) {
    throw new Error(
      `body 템플릿 개수 불일치: 파일에서 ${idx}개 발견, 편집 결과 ${orderedHtmls.length}개`
    );
  }

  return out;
}
