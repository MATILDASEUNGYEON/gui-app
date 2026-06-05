/*
  헤드리스 렌더링 후 평탄화(flatten).

  requirestplusapi_output.html 처럼 화면 본문을 JS 함수(chrome(...) 등)로 동적
  생성하는 와이어프레임은 정적 파싱이 불가능하다. 이때 Playwright로 파일을 실제로
  렌더링해 전역 SCREENS(이미 문자열로 확정된 body + 메타데이터)와 페이지 CSS를 읽어,
  편집 가능한 '정적 canonical' 파일로 재구성한다.

  canonical 형식 = `const SCREENS = [{ id, group, title, purpose, body: `정적 HTML` }]`
  + 최소 셸/렌더러. 이 형식은 server/screens.ts가 그대로 편집/재주입할 수 있다.
*/
import { chromium } from 'playwright';

export interface FlattenResult {
  html: string;
  screenCount: number;
}

interface CapturedScreen {
  id: string;
  group: string;
  title: string;
  purpose: string;
  body: string;
}

// 페이지 컨텍스트에서 실행할 코드(문자열). bare `SCREENS`는 classic <script>의
// 최상위 const라 전역 lexical 환경에서 이름으로 접근된다(globalThis.SCREENS 아님).
const READ_SCREENS = `(() => {
  if (typeof SCREENS === 'undefined' || !SCREENS) return null;
  const entries = Array.isArray(SCREENS)
    ? SCREENS.map((s, i) => [s && s.id != null ? s.id : String(i), s])
    : Object.entries(SCREENS);
  return entries
    .filter(([, s]) => s && typeof s === 'object')
    .map(([id, s]) => ({
      id: String(id),
      group: String(s.group ?? s.cat ?? ''),
      title: String(s.title ?? id),
      purpose: String(s.purpose ?? s.desc ?? ''),
      body: typeof s.body === 'string' ? s.body : ''
    }));
})()`;

const READ_CSS = `Array.from(document.querySelectorAll('style'))
  .map((s) => s.textContent || '').join('\\n')`;

function escapeForTemplate(s: string): string {
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${');
}

// 최소 셸 레이아웃 CSS (원본 CSS와 충돌을 줄이려 cw- 접두사 사용).
const SHELL_CSS = `
.cw-layout{display:grid;grid-template-columns:240px 1fr;height:100vh;}
.cw-nav{overflow:auto;border-right:1px solid #d8dbe0;background:#fff;padding:8px 0;}
.cw-nitem{padding:9px 16px;cursor:pointer;border-left:3px solid transparent;font-size:13px;color:#1f2329;}
.cw-nitem:hover{background:#f5f6f8;}
.cw-nitem.active{background:#e8eaee;border-left-color:#3b3f46;font-weight:600;}
.cw-main{overflow:auto;height:100vh;}
`;

function buildCanonical(screens: CapturedScreen[], originalCss: string): string {
  const items = screens
    .map(
      (s) =>
        `  { id: ${JSON.stringify(s.id)}, group: ${JSON.stringify(
          s.group
        )}, title: ${JSON.stringify(s.title)}, purpose: ${JSON.stringify(
          s.purpose
        )},\n    body: \`\n${escapeForTemplate(s.body)}\n    \` }`
    )
    .join(',\n');

  const title = screens[0]?.title || '와이어프레임';

  // 원본 CSS를 '첫 번째' <style>로 둔다: server/screens.ts의 extractStyleCss가
  // 첫 <style>만 추출해 편집 캔버스에 주입하므로, 캡처된 body가 제대로 렌더된다.
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} — 와이어프레임</title>
  <style>${originalCss}</style>
  <style>${SHELL_CSS}</style>
</head>
<body>
  <div class="cw-layout">
    <nav class="cw-nav" id="cwNav"></nav>
    <main class="cw-main" id="cwMain"></main>
  </div>
  <script>
/* 평탄화(flatten)로 생성된 정적 화면설계서. 각 화면 body는 GUI로 편집 가능하다. */
const SCREENS = [
${items}
];
(function () {
  var nav = document.getElementById('cwNav');
  var main = document.getElementById('cwMain');
  function go(id) {
    var s = SCREENS.filter(function (x) { return x.id === id; })[0] || SCREENS[0];
    if (!s) return;
    main.innerHTML = s.body;
    Array.prototype.forEach.call(nav.children, function (c) {
      c.classList.toggle('active', c.getAttribute('data-id') === s.id);
    });
  }
  SCREENS.forEach(function (s) {
    var d = document.createElement('div');
    d.className = 'cw-nitem';
    d.setAttribute('data-id', s.id);
    d.textContent = s.title || s.id;
    d.onclick = function () { go(s.id); };
    nav.appendChild(d);
  });
  if (SCREENS[0]) go(SCREENS[0].id);
})();
  </script>
</body>
</html>
`;
}

/*
  동적 본문 와이어프레임을 렌더링해 정적 canonical 파일로 평탄화한다.
  SCREENS를 읽지 못하면 null 반환(호출 측에서 안내).
  Chromium 실행 자체가 실패하면(예: 시스템 라이브러리 누락) 에러를 그대로 던진다.
*/
export async function flattenWireframe(sourceHtml: string): Promise<FlattenResult | null> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(sourceHtml, { waitUntil: 'networkidle' });

    const screens = (await page.evaluate(READ_SCREENS)) as CapturedScreen[] | null;
    if (!screens || screens.length === 0) {
      return null;
    }

    const css = (await page.evaluate(READ_CSS)) as string;
    return { html: buildCanonical(screens, css), screenCount: screens.length };
  } finally {
    await browser.close();
  }
}
