/*
  Express + Vite(미들웨어 모드) 서버. GUI-test/server.mjs 포팅.
  입력 소스를 sample/ 고정 폴더 → workspace/ + import API 로 교체.
*/
import express from 'express';
import type { Request, Response } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import {
  isScreensFile,
  extractStyleCss,
  extractScreens,
  reinjectBodies,
  DynamicBodiesError
} from './screens.ts';
import { flattenWireframe } from './flatten.ts';
import * as store from './store.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '..');

const app = express();
app.use(express.json({ limit: '50mb' }));

/* 가져오기: 외부에서 만든 와이어프레임 .html을 붙여넣기/첨부로 받는다. */
app.post('/api/projects/import', async (req: Request, res: Response) => {
  try {
    const { name, html } = req.body ?? {};
    if (typeof html !== 'string' || !html.trim()) {
      throw new Error('html is required');
    }

    const displayName =
      typeof name === 'string' && name.trim() ? name : 'wireframe';
    const screens = isScreensFile(html);

    // SCREENS 파일이면 정적 파싱 가능 여부를 먼저 확인한다.
    // 동적 본문(body:chrome(...) 등)이면 헤드리스 렌더링으로 평탄화한다.
    let toStore = html;
    let flattened = false;

    if (screens) {
      try {
        extractScreens(html); // 정적이면 통과
      } catch (e) {
        if (!(e instanceof DynamicBodiesError)) throw e;
        // 동적 본문 → 평탄화 시도
        let result;
        try {
          result = await flattenWireframe(html);
        } catch (renderErr) {
          // Playwright는 멀티라인 브라우저 로그를 던지므로 첫 줄만 노출한다.
          const brief = (renderErr as Error).message.split('\n')[0];
          throw new Error(
            '동적 와이어프레임 평탄화에 실패했습니다(헤드리스 브라우저 실행 오류). ' +
              '서버에 Chromium과 시스템 의존성을 설치하세요: ' +
              '`npx playwright install --with-deps chromium`. ' +
              `(상세: ${brief})`
          );
        }
        if (!result) {
          throw new Error(
            '렌더링 후에도 SCREENS 데이터를 찾지 못했습니다. 지원되지 않는 와이어프레임 형식입니다.'
          );
        }
        toStore = result.html;
        flattened = true;
      }
    }

    const id = await store.create(displayName, toStore);
    res.json({
      id,
      kind: screens ? 'screens' : 'html',
      isScreens: screens,
      flattened
    });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.get('/api/projects', async (_req: Request, res: Response) => {
  try {
    const projects = await store.list();
    res.json({ projects });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.delete('/api/projects/:id', async (req: Request, res: Response) => {
  try {
    const id = store.assertSafeId(req.params.id);
    await store.remove(id);
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

/* 내보내기(다운로드): 저장된 .html을 첨부 파일로 스트리밍. */
app.get('/api/projects/:id/download', async (req: Request, res: Response) => {
  try {
    const id = store.assertSafeId(req.params.id);
    const html = await store.read(id);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(id)}"`);
    res.send(html);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

/* 편집용 로드: SCREENS면 화면별 페이지로, 아니면 단일 페이지로 펼친다. */
app.get('/api/project', async (req: Request, res: Response) => {
  try {
    const id = store.assertSafeId(req.query.id);
    const html = await store.read(id);

    if (isScreensFile(html)) {
      const styleCss = extractStyleCss(html);
      const screens = extractScreens(html);
      const styleTag = styleCss ? `<style>${styleCss}</style>` : '';

      res.json({
        kind: 'screens',
        screens: screens.map((s) => ({ id: s.id, title: s.title })),
        project: {
          pages: screens.map((s) => ({
            // 페이지 이름 = 화면 id (저장 시 매핑 키)
            name: s.id,
            // 디자인 시스템 CSS를 함께 넣어 캔버스에서 제대로 렌더되게 한다.
            component: `${styleTag}${s.body || ''}`
          }))
        }
      });
      return;
    }

    // 일반 HTML 파일: 단일 페이지로 로드.
    res.json({
      kind: 'html',
      project: {
        pages: [
          {
            name: id.replace(/\.html$/, ''),
            component: html
          }
        ]
      }
    });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

/* 저장: 편집 결과를 원본에 반영한다. */
app.post('/api/export-html', async (req: Request, res: Response) => {
  try {
    const id = store.assertSafeId(req.body?.id);
    const { html, pages } = req.body ?? {};

    // SCREENS 기반 SPA: 편집된 페이지 HTML을 원본 SCREENS[i].body에 재주입.
    if (Array.isArray(pages)) {
      const source = await store.read(id);

      if (!isScreensFile(source)) {
        throw new Error('pages 저장은 SCREENS 기반 파일에만 사용할 수 있습니다.');
      }

      const screens = extractScreens(source);
      const byId = new Map<string, string>(
        pages
          .filter((p: { id?: string; html?: string }) => p && typeof p.html === 'string')
          .map((p: { id: string; html: string }) => [p.id, p.html])
      );
      const sameCount = pages.length === screens.length;

      const orderedHtmls = screens.map((s, i) => {
        if (byId.has(s.id)) return byId.get(s.id) as string;
        if (sameCount && typeof pages[i]?.html === 'string') return pages[i].html;
        return s.body || '';
      });

      const next = reinjectBodies(source, orderedHtmls);
      await store.write(id, next);

      res.json({ ok: true, id, kind: 'screens' });
      return;
    }

    // 일반 HTML 파일: 전체 문서를 그대로 덮어쓴다.
    if (typeof html !== 'string') {
      throw new Error('html (또는 pages) is required');
    }

    await store.write(id, html);
    res.json({ ok: true, id, kind: 'html' });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

const vite = await createViteServer({
  root: ROOT_DIR,
  server: {
    middlewareMode: true,
    // workspace/ 의 .html은 API로 저장되는 '데이터'이므로 감시 대상에서 제외한다.
    // 제외하지 않으면 가져오기/자동저장마다 Vite가 전체 페이지를 리로드해
    // React 상태(편집 화면)가 초기화된다.
    watch: { ignored: ['**/workspace/**'] }
  },
  appType: 'spa'
});

app.use(vite.middlewares);

const port = Number(process.env.PORT) || 5188;
app.listen(port, () => {
  console.log(`Wireframe GUI Studio running at http://localhost:${port}`);
});
