# Responses Lab

Vanilla JavaScript와 Vite로 만든 OpenAI Responses API 교육용 챗봇입니다. 브라우저의 기본 `fetch`로 OpenAI API를 직접 호출하며, 별도 백엔드나 Netlify 함수, 외부 JavaScript 라이브러리는 사용하지 않습니다. 코드 작업 규칙은 [AGENTS.md](./AGENTS.md)를 먼저 읽어 주세요.

## API 키 입력 및 실행

1. 프로젝트 루트의 `.env.local`에 본인의 OpenAI API 키를 입력합니다. 키를 따옴표 없이 `=` 뒤에 적습니다.

   ```dotenv
   VITE_OPENAI_API_KEY=여기에_본인의_API_키_입력
   ```

   `.env.local`은 비워 둔 변수와 함께 준비되어 있습니다. 다른 컴퓨터에서 저장소를 내려받았다면 `.env.example`을 `.env.local`로 복사한 뒤 키를 입력합니다.

2. 터미널에서 의존성을 설치하고 개발 서버를 실행합니다.

   ```sh
   npm install
   npm run dev
   ```

3. 터미널에 표시된 로컬 주소를 브라우저로 엽니다.
4. 환경 변수를 변경한 뒤에는 개발 서버 터미널에서 `Ctrl + C`로 종료하고, `npm run dev`를 다시 실행합니다. 브라우저도 새로고침합니다.

메시지는 전송 버튼 또는 Enter로 전송하며 Shift + Enter로 줄바꿈합니다. 응답 대기 중에는 입력, 전송, 초기화 버튼이 잠겨 중복 요청을 막습니다. 한국어 입력기의 글자 조합 중 Enter는 전송하지 않습니다. 대화 초기화 또는 새로고침 시 현재 대화 기록이 사라집니다.

## 요청과 응답

- 사용 모델: `gpt-6-luna` (공식 모델 문서에서 Responses 지원 확인)
- 요청 주소: `POST https://api.openai.com/v1/responses`
- 인증: `Authorization: Bearer <API 키>` 헤더
- 요청: `model`, `instructions`, 대화 기록인 `input`, `reasoning: { effort: 'none' }`, `max_output_tokens: 2048`, `store: false`
- 대화 기록: 이전에 성공한 사용자 메시지와 답변을 `user` / `assistant` 역할로 순서대로 보낸 뒤 새 질문을 추가합니다. 실패한 요청은 기록에 추가하지 않고 입력창을 복원합니다.
- 응답: `output` 배열의 assistant 메시지에서 `content`의 `output_text.text`를 모아 표시합니다. 응답 거절인 `refusal`도 표시합니다. REST JSON에 SDK 편의 속성인 `response.output_text`가 있다고 가정하지 않습니다.
- 인증, 권한, 모델 접근, 과금·사용 한도, 요청 속도, 네트워크, 응답 길이 초과 및 서버 오류를 한국어로 안내합니다. 요청은 60초 뒤 시간 초과 처리하며 자동 재시도하지 않습니다.
- 사용자 메시지와 답변은 HTML로 해석하지 않고 텍스트로 표시합니다.

`store: false`는 응답 객체 저장을 끄는 설정이며, 모든 서버 로그의 미보관을 보장하는 의미는 아닙니다. 로컬 대화 기록은 메모리에만 보관하지만, 메시지를 보낼 때 해당 기록이 OpenAI로 전송됩니다. 대화가 길어질수록 입력 사용량도 증가하며 API 사용료가 발생합니다.

| 화면 상태 | 의미 |
| --- | --- |
| 키 미설정 | 환경 변수가 없거나 공백입니다. 요청하지 않습니다. |
| 연결 미확인 | 키가 있지만 아직 요청 결과를 확인하지 않았습니다. |
| 요청 중 | 실제 Responses API 답변을 기다리는 중입니다. |
| 요청 성공 | 완료된 실제 API 응답에서 답변을 받았습니다. |
| 요청 실패 | HTTP 오류, 시간 초과 또는 완료되지 않은 응답 등입니다. |

초기화하면 상태도 키 유무에 따른 초기 상태로 돌아갑니다. 페이지를 열거나 키가 존재한다는 이유만으로 성공 상태를 표시하거나 연결 확인용 유료 요청을 보내지 않습니다. 모델 접근 가능 여부는 계정과 프로젝트에 따라 다를 수 있습니다.

## 빌드 및 검사

```sh
npm test
npm run build
```

테스트는 가짜 키와 모의 HTTP 응답을 사용하므로 실제 OpenAI 요청이나 과금이 발생하지 않습니다. Vite는 루트의 `index.html`을 진입점으로 사용하고 결과물을 `dist/`에 생성합니다.

## 키 노출과 공개 배포 주의

**`VITE_` 환경 변수는 API 키를 숨기지 못합니다.** Vite가 키를 브라우저 JavaScript에 포함하므로 개발자 도구, 네트워크 요청 및 빌드 파일에서 확인할 수 있습니다. `.gitignore`로 `.env.local`을 제외하는 것은 소스 파일의 업로드만 막으며, 브라우저에서 키를 보호하지 않습니다.

**실제 키가 포함된 `dist/`나 개발 서버를 공개하지 마세요.** 실제 키를 입력한 상태에서 만든 결과물을 Netlify 등에 배포하면 다른 사람이 키를 가져가 사용료를 발생시킬 수 있습니다. 키를 제거한 후 개발 서버를 재시작하고 다시 빌드해야 기존 결과물에서도 키가 빠집니다. 이미 노출된 키는 OpenAI에서 폐기하고 새 키를 발급받아야 합니다. 공개 서비스에서는 서버 측에서 키를 관리하는 별도 구조가 필요합니다.

Netlify의 기본 설정은 Build command `npm run build`, Publish directory `dist`입니다. 다만 이 교육용 브라우저 호출 구조에 **실제 키를 설정한 상태로 공개 배포하면 안 됩니다.**

## 참고한 OpenAI 공식 문서

2026-11-09 확인:

- [텍스트 생성과 Responses API 요청·응답](https://developers.openai.com/api/docs/guides/text)
- [대화 상태와 이전 메시지 전달](https://developers.openai.com/api/docs/guides/conversation-state)
- [GPT-6 Luna 모델과 지원 기능](https://developers.openai.com/api/docs/models/gpt-6-luna)
- [Responses 생성 API 참조](https://developers.openai.com/api/reference/resources/responses/methods/create)
- [API 인증 및 클라이언트 코드의 키 노출 주의](https://developers.openai.com/api/reference/overview#authentication)
- [API 오류 코드](https://developers.openai.com/api/docs/guides/error-codes)
