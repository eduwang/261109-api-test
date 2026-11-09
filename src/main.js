import './style.css'
import { MODEL, requestReply } from './openai.js'

// 교육용 브라우저 직접 호출: VITE_ 환경 변수는 빌드 결과에 포함되어 노출됩니다.
const apiKey = (import.meta.env.VITE_OPENAI_API_KEY ?? '').trim()
const form = document.querySelector('#chat-form')
const input = document.querySelector('#message-input')
const sendButton = document.querySelector('#send-button')
const sendLabel = document.querySelector('#send-label')
const resetButton = document.querySelector('#reset-button')
const status = document.querySelector('#api-status')
const detail = document.querySelector('#api-detail')
const errorNotice = document.querySelector('#request-error')
const conversation = document.querySelector('#conversation')
const messages = document.querySelector('#messages')
const emptyState = document.querySelector('#empty-state')
const messageTemplate = document.querySelector('#message-template')

let history = []
let isLoading = false

document.querySelector('#model-name').textContent = MODEL

function setStatus(state, label, description) {
  status.dataset.state = state
  status.textContent = label
  detail.textContent = description
}

function resetStatus() {
  if (apiKey) {
    setStatus('unverified', '연결 미확인', '첫 메시지를 전송하면 실제 API 요청 결과를 확인할 수 있습니다.')
  } else {
    setStatus('missing', '키 미설정', '루트의 .env.local에 VITE_OPENAI_API_KEY를 입력하고 개발 서버를 재시작해 주세요.')
  }
}

function updateControls() {
  input.disabled = isLoading
  sendButton.disabled = isLoading || !apiKey || !input.value.trim()
  resetButton.disabled = isLoading
  sendLabel.textContent = isLoading ? '응답 대기 중' : '전송'
  conversation.setAttribute('aria-busy', String(isLoading))
}

function addMessage(role, text, pending = false) {
  const message = messageTemplate.content.firstElementChild.cloneNode(true)
  message.dataset.role = role
  message.classList.toggle('is-pending', pending)
  message.querySelector('.message-role').textContent = role === 'user' ? '나' : 'ASSISTANT'
  // 사용자 입력과 모델 출력 모두 HTML로 해석하지 않습니다.
  message.querySelector('.message-content').textContent = text
  messages.append(message)
  conversation.scrollTop = conversation.scrollHeight
  return message
}

form.addEventListener('submit', async (event) => {
  event.preventDefault()
  const text = input.value.trim()
  if (isLoading || !apiKey || !text) return

  const userMessage = { role: 'user', content: text }
  isLoading = true
  errorNotice.hidden = true
  errorNotice.textContent = ''
  emptyState.hidden = true
  input.value = ''
  updateControls()
  setStatus('loading', '요청 중', '답변을 기다리고 있습니다. 잠시만 기다려 주세요.')
  const userBubble = addMessage('user', text)
  const pendingBubble = addMessage('assistant', '답변을 작성하고 있어요…', true)

  try {
    const reply = await requestReply(apiKey, [...history, userMessage])
    history.push(userMessage, { role: 'assistant', content: reply })
    pendingBubble.remove()
    addMessage('assistant', reply)
    setStatus('success', '요청 성공', 'Responses API에서 답변을 받았습니다. 이어서 질문해 보세요.')
  } catch (error) {
    userBubble.remove()
    pendingBubble.remove()
    input.value = text
    emptyState.hidden = history.length > 0
    errorNotice.textContent = error.message
    errorNotice.hidden = false
    setStatus('error', '요청 실패', '아래 안내를 확인해 주세요. 입력한 메시지는 다시 전송할 수 있도록 복원했습니다.')
  } finally {
    isLoading = false
    updateControls()
    input.focus()
  }
})

input.addEventListener('input', updateControls)
input.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && event.keyCode !== 229) {
    event.preventDefault()
    form.requestSubmit()
  }
})

resetButton.addEventListener('click', () => {
  if (isLoading) return
  history = []
  messages.replaceChildren()
  emptyState.hidden = false
  errorNotice.hidden = true
  errorNotice.textContent = ''
  input.value = ''
  resetStatus()
  updateControls()
  input.focus()
})

resetStatus()
updateControls()
