import assert from 'node:assert/strict'
import { test } from 'node:test'
import { MODEL, requestReply } from '../src/openai.js'

const fakeKey = 'test-only-not-a-real-key'
const question = [{ role: 'user', content: '안녕' }]
const completed = (content = [{ type: 'output_text', text: '안녕하세요!' }]) => ({
  status: 'completed',
  output: [{ type: 'message', role: 'assistant', content }],
})

test('Responses endpoint에 대화 기록, 모델, 인증 헤더를 보낸다', async (t) => {
  const history = [
    { role: 'user', content: '제 이름은 민수입니다.' },
    { role: 'assistant', content: '반갑습니다, 민수님.' },
    { role: 'user', content: '제 이름이 무엇인가요?' },
  ]
  const fetchMock = t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/responses')
    assert.equal(options.method, 'POST')
    assert.equal(options.headers.Authorization, `Bearer ${fakeKey}`)
    assert.equal(options.headers['Content-Type'], 'application/json')
    const body = JSON.parse(options.body)
    assert.equal(body.model, MODEL)
    assert.deepEqual(body.input, history)
    assert.equal(body.store, false)
    assert.deepEqual(body.reasoning, { effort: 'none' })
    assert.ok(options.signal instanceof AbortSignal)
    return Response.json(completed())
  })
  assert.equal(await requestReply(fakeKey, history), '안녕하세요!')
  assert.equal(fetchMock.mock.callCount(), 1)
  assert.equal(history.length, 3)
})

test('첫 output이 reasoning이어도 여러 텍스트 블록을 모두 읽는다', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({
    status: 'completed',
    output: [
      { type: 'reasoning', summary: [] },
      { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: '첫 번째' }] },
      { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: '두 번째' }] },
    ],
  }))
  assert.equal(await requestReply(fakeKey, question), '첫 번째\n\n두 번째')
})

test('refusal을 빈 응답으로 취급하지 않고 표시한다', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json(completed([
    { type: 'refusal', refusal: '이 요청에는 답변할 수 없습니다.' },
  ])))
  assert.equal(await requestReply(fakeKey, question), '이 요청에는 답변할 수 없습니다.')
})

test('키가 비어 있으면 네트워크 요청을 보내지 않는다', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', () => { throw new Error('호출하면 안 됨') })
  await assert.rejects(requestReply('   ', question), /키가 설정되지/)
  assert.equal(fetchMock.mock.callCount(), 0)
})

const failures = [
  [401, { code: 'invalid_api_key' }, /인증에 실패/],
  [403, {}, /사용 권한/],
  [404, { code: 'model_not_found' }, /모델.*접근 권한/],
  [429, { code: 'credit_balance_exhausted' }, /크레딧/],
  [429, { type: 'insufficient_quota' }, /사용 한도/],
  [429, { code: 'project_spend_limit_exceeded' }, /프로젝트.*한도/],
  [429, { code: 'rate_limit_exceeded' }, /요청이 너무 많/],
  [400, { code: 'context_length_exceeded' }, /대화가 너무 길/],
  [400, {}, /요청 형식/],
  [503, {}, /서버.*오류/],
]

for (const [status, error, expected] of failures) {
  test(`HTTP ${status} ${error.code ?? error.type ?? ''} 원인을 안내한다`, async (t) => {
    const fetchMock = t.mock.method(globalThis, 'fetch', async () => Response.json({ error }, { status }))
    await assert.rejects(requestReply(fakeKey, question), expected)
    assert.equal(fetchMock.mock.callCount(), 1, '오류를 자동 재시도하지 않아야 함')
  })
}

test('네트워크 연결 실패를 안내한다', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Failed to fetch') })
  await assert.rejects(requestReply(fakeKey, question), /네트워크.*보안 정책/)
})

test('요청 시간 초과를 안내한다', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => { throw new DOMException('timeout', 'TimeoutError') })
  await assert.rejects(requestReply(fakeKey, question), /60초.*자동 재시도하지/)
})

test('응답 본문을 읽는 중 시간 초과도 안내한다', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => ({
    ok: true,
    json: async () => { throw new DOMException('aborted', 'AbortError') },
  }))
  await assert.rejects(requestReply(fakeKey, question), /60초/)
})

test('JSON이 아닌 성공 응답을 성공으로 표시하지 않는다', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('<html>오류</html>'))
  await assert.rejects(requestReply(fakeKey, question), /JSON으로 읽을 수 없/)
})

test('JSON이 아닌 HTTP 오류에서도 상태별 안내를 유지한다', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('Service unavailable', { status: 503 }))
  await assert.rejects(requestReply(fakeKey, question), /서버.*오류/)
})

test('출력이 길이 한도에 걸리면 완료되지 않았음을 안내한다', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({
    status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' }, output: [],
  }))
  await assert.rejects(requestReply(fakeKey, question), /출력 길이 한도/)
})

test('빈 텍스트 응답을 성공으로 취급하지 않는다', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json(completed([])))
  await assert.rejects(requestReply(fakeKey, question), /표시할 텍스트/)
})

test('실패 상태의 HTTP 200 응답을 성공으로 취급하지 않는다', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ status: 'failed', output: [] }))
  await assert.rejects(requestReply(fakeKey, question), /완료된 API 응답/)
})
