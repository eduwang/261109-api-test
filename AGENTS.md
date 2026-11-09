# 프로젝트 작업 규칙

이 프로젝트는 Vanilla JavaScript를 사용하는 Vite 프로젝트이며, GitHub 저장소를 Netlify에 연결해 배포합니다. 향후 코드 작업 전에 이 문서를 먼저 읽고 다음 규칙을 따릅니다.

1. HTML, CSS, JavaScript 코드는 각각 분리된 파일로 작성합니다.
2. `index.html`은 프로젝트 루트에, 애플리케이션의 CSS와 JavaScript 파일은 `src/` 폴더에 작성합니다. `vite.config.js` 등 설정 파일은 프로젝트 루트에 둡니다.
3. JavaScript는 `<script type="module" src="/src/main.js"></script>`처럼 모듈 방식으로 연결합니다. CSS는 JavaScript 진입 파일에서 `import './style.css'`처럼 import하여 Vite 빌드에 포함합니다.
4. 외부 JavaScript 라이브러리는 `npm install`로 설치하고 import하여 사용합니다. CDN 방식은 사용하지 않습니다.
5. 기존 파일과 설정을 먼저 확인하고 필요한 부분만 수정합니다.

## Vite 빌드

- 기본 진입점인 루트의 `index.html`과 기본 빌드 출력 폴더인 `dist/`를 사용합니다.
- `vite.config.js`에는 필요한 설정만 추가합니다. 기본값인 `root`, 빌드 진입점, `build.outDir`을 불필요하게 명시하지 않습니다.
- `package.json`의 빌드 스크립트는 `"build": "vite build"`를 사용합니다.
- 작업 후 `npm run build`를 실행하여 빌드가 정상적으로 완료되는지 확인합니다.

## Netlify 배포 설정

GitHub 저장소를 Netlify에 연결한 뒤 다음 값을 사용합니다.

- Build command: `npm run build`
- Publish directory: `dist`

참고: [Netlify의 Vite 배포 안내](https://docs.netlify.com/build/frameworks/framework-setup-guides/vite/)
