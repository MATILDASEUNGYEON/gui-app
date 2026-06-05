# 와이어프레임 GUI 스튜디오

외부에서 만든 와이어프레임 `.html`을 **붙여넣기/첨부 → GUI(GrapesJS)로 편집 → `.html`로 내보내기** 하는 서비스.

- 프론트엔드: React + TypeScript + Vite
- 백엔드: Node + TypeScript + Express (Vite 미들웨어)
- 편집기: GrapesJS Studio SDK
- 동적(JS 렌더링) 와이어프레임은 가져올 때 Playwright(Chromium)로 렌더링해 **정적 형식으로 평탄화(flatten)** 후 편집

이 폴더(`app/`)는 **단독으로 실행**됩니다. 같은 저장소의 `GUI-test/`(원본 프로토타입)에는 런타임 의존성이 없습니다.

---

## 요구 사항

- Node.js 18+ (권장 20+)
- 동적 와이어프레임 평탄화를 쓰려면 **Chromium + 시스템 의존성** 필요
  - 정적 SCREENS 파일만 다룬다면 Chromium 없이도 동작합니다.

## 설치 & 실행 (외부 서버 / git clone)

```bash
git clone <your-repo-url> wireframe-gui
cd wireframe-gui            # app/ 내용이 루트인 경우

npm install

# (동적 와이어프레임을 쓸 경우) Chromium + 시스템 의존성 설치
#   --with-deps 는 apt 의존성까지 설치하므로 sudo 권한이 필요할 수 있습니다.
npx playwright install --with-deps chromium

# 서버 실행 (기본 포트 5188)
npm run dev
#   PORT=8080 npm run dev   # 포트 변경
```

브라우저에서 `http://<서버-IP>:5188` 접속.

> 외부에서 접속하려면 서버 방화벽/보안그룹에서 해당 포트를 열어야 합니다.

## 데이터 저장

- 가져온/편집 중인 프로젝트는 `workspace/` 폴더에 `.html`로 저장됩니다.
- `workspace/`와 `node_modules/`는 git에 올라가지 않습니다(`.gitignore`).
- 서버를 옮길 때 편집 중인 프로젝트를 보존하려면 `workspace/`를 함께 복사하세요.

## 라이선스 키 (외부 도메인/IP 배포 시 필수)

GrapesJS Studio SDK 라이선스 정책:

- **localhost 접속**: 아무 키나 유효합니다. 키를 지정하지 않으면 `DEV_LICENSE_KEY`로 자동 폴백되어 그대로 동작합니다.
- **외부 도메인/IP 접속**(예: `http://서버IP:8080`): `DEV_LICENSE_KEY`는 동작하지 않고 **License Error**가 납니다. 실제 키가 필요합니다.

실제 키는 [app.grapesjs.com](https://app.grapesjs.com) 에서 무료로 발급받아 환경변수로 주입하세요.

```bash
VITE_GRAPESJS_LICENSE_KEY=발급받은-키 npm run dev
```

> 빈 문자열(`''`)을 키로 넘기면 '잘못된 키'로 처리되어 localhost에서도 License Error가 납니다. 그래서 폴백을 빈 문자열이 아닌 `DEV_LICENSE_KEY`로 두었습니다.

## 동작 개요

| 입력 형식 | 처리 |
|---|---|
| `SCREENS` 배열, 정적 `body: \`...\`` | 그대로 화면별 페이지로 편집 |
| `SCREENS` 객체 맵, 정적 본문 | 그대로 편집 |
| `SCREENS`, 동적 본문(`body: chrome(...)` 등) | Chromium으로 렌더링 후 정적 형식으로 평탄화하여 편집 |
| 일반 HTML | 단일 페이지로 편집 |

## 트러블슈팅

- **'편집 시작'을 눌러도 화면이 안 넘어감 / 가져오기 오류**: 동적 와이어프레임인데 서버에 Chromium이 없을 때 발생합니다. `npx playwright install --with-deps chromium`를 실행하세요. (가져오기 화면에 빨간 오류 메시지로 원인이 표시됩니다.)
- **License Error**: 외부 도메인/IP로 접속했는데 실제 라이선스 키가 없을 때 납니다. 위 「라이선스 키」 섹션 참고. (localhost 접속이면 발생하지 않음)
- **포트 충돌**: `PORT=다른포트 npm run dev`.
