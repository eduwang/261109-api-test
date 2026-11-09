export const MODEL = 'gpt-6-luna'

function apiErrorMessage(status, error = {}) {
  const code = error.code ?? error.type

  if (status === 401) return 'API 키 인증에 실패했습니다. .env.local의 키가 올바르고 활성 상태인지 확인한 뒤 개발 서버를 재시작해 주세요. (401)'
  if (status === 403) return 'API 사용 권한이 없습니다. 키의 권한, 프로젝트 설정, 지원 지역을 확인해 주세요. (403)'
  if (status === 404 || code === 'model_not_found') return `모델 ${MODEL}을 사용할 수 없습니다. 해당 프로젝트의 모델 접근 권한을 확인해 주세요. (HTTP ${status})`
  if (status === 429) {
    if (code === 'credit_balance_exhausted' || code === 'insufficient_quota' || error.type === 'insufficient_quota') {
      return 'API 크레딧 또는 사용 한도가 부족합니다. OpenAI API 결제 설정과 프로젝트 한도를 확인해 주세요. (429)'
    }
    if (['organization_spend_limit_exceeded', 'project_spend_limit_exceeded', 'organization_usage_limit_exceeded'].includes(code)) {
      return '조직 또는 프로젝트의 API 사용 한도에 도달했습니다. 결제 및 사용 한도 설정을 확인해 주세요. (429)'
    }
    return '짧은 시간에 요청이 너무 많았습니다. 잠시 기다린 뒤 다시 전송해 주세요. (429)'
  }
  if (code === 'context_length_exceeded') return '대화가 너무 길어졌습니다. 대화를 초기화하고 더 짧은 메시지로 다시 시작해 주세요.'
  if (status === 400) return '요청 형식이나 입력 내용을 처리할 수 없습니다. 메시지를 줄이거나 대화를 초기화한 뒤 다시 시도해 주세요. (400)'
  if (status >= 500) return 'OpenAI 서버에서 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
  return `API 요청을 처리하지 못했습니다. 키와 프로젝트 설정을 확인해 주세요. (HTTP ${status})`
}

export async function requestReply(apiKey, input) {
  if (!apiKey.trim()) throw new Error('API 키가 설정되지 않았습니다. .env.local을 확인해 주세요.')

  let response
  let data

  try {
    response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        instructions: '사용자의 언어로 명확하고 간결하게 답하세요. 답변은 일반 텍스트로 작성하세요.',
        input,
        reasoning: { effort: 'none' },
        max_output_tokens: 2048,
        store: false,
      }),
      signal: AbortSignal.timeout(60000),
    })

    try {
      data = await response.json()
    } catch (error) {
      if (error.name === 'TimeoutError' || error.name === 'AbortError') throw error
      if (!response.ok) throw new Error(apiErrorMessage(response.status))
      throw new Error('API 응답을 JSON으로 읽을 수 없습니다. 잠시 후 다시 시도해 주세요.')
    }
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      throw new Error('60초 안에 응답을 받지 못했습니다. 잠시 후 다시 시도해 주세요. 서버에서 이미 처리 중일 수 있어 자동 재시도하지 않습니다.')
    }
    if (error instanceof TypeError) {
      throw new Error('네트워크 또는 브라우저 보안 정책으로 API에 연결할 수 없습니다. 인터넷 연결과 브라우저의 네트워크 오류를 확인해 주세요.')
    }
    throw error
  }

  if (!response.ok) throw new Error(apiErrorMessage(response.status, data?.error ?? {}))
  if (data?.error) throw new Error('API가 답변 생성 중 오류를 반환했습니다. 잠시 후 다시 시도해 주세요.')
  if (data?.status === 'incomplete') {
    const reason = data.incomplete_details?.reason
    throw new Error(reason === 'max_output_tokens'
      ? '답변이 출력 길이 한도에 도달해 완료되지 않았습니다. 더 짧은 답변을 요청해 주세요.'
      : 'API가 답변을 끝까지 생성하지 못했습니다. 질문을 바꿔 다시 시도해 주세요.')
  }
  if (data?.status !== 'completed' || !Array.isArray(data.output)) {
    throw new Error('완료된 API 응답을 받지 못했습니다. 잠시 후 다시 시도해 주세요.')
  }

  // REST 응답은 SDK 편의 속성 output_text 대신 output 배열에서 읽습니다.
  const reply = data.output
    .filter((item) => item.type === 'message' && item.role === 'assistant')
    .flatMap((item) => item.content ?? [])
    .map((part) => part.type === 'output_text' ? part.text : part.type === 'refusal' ? part.refusal : '')
    .filter((text) => typeof text === 'string' && text.trim())
    .join('\n\n')
    .trim()

  if (!reply) throw new Error('응답에서 표시할 텍스트를 찾지 못했습니다. 질문을 바꿔 다시 시도해 주세요.')
  return reply
}
