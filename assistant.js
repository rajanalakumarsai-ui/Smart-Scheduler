const conversationElement = document.querySelector('#conversation');
const assistantStatus = document.querySelector('#assistant-status');
const questionForm = document.querySelector('#question-form');
const questionInput = document.querySelector('#question');
const sendButton = document.querySelector('#send-button');
let conversation = [];
let assistantBusy = false;

function setAssistantStatus(message = '', isError = false) {
    assistantStatus.textContent = message;
    assistantStatus.classList.toggle('error', isError);
}

function addMessage(role, text, sources = []) {
    const bubble = document.createElement('article');
    bubble.className = `message ${role === 'user' ? 'user-message' : 'assistant-message'}`;
    const content = document.createElement('p');
    content.textContent = text;
    bubble.append(content);

    if (role === 'model' && sources.length) {
        const sourceList = document.createElement('div');
        sourceList.className = 'source-list';
        const label = document.createElement('strong');
        label.textContent = 'Sources';
        sourceList.append(label);
        sources.forEach((source) => {
            if (!source || typeof source.url !== 'string' || typeof source.title !== 'string') return;
            let url;
            try {
                url = new URL(source.url);
            } catch {
                return;
            }
            if (url.protocol !== 'https:') return;
            const link = document.createElement('a');
            link.href = url.href;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = source.title;
            sourceList.append(link);
        });
        if (sourceList.childElementCount > 1) bubble.append(sourceList);
    }

    conversationElement.append(bubble);
    conversationElement.scrollTop = conversationElement.scrollHeight;
}

async function requestJson(path, options = {}) {
    const response = await fetch(path, options);
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('application/json')) {
        throw new Error(
            `The assistant API returned a non-JSON response (HTTP ${response.status}). Stop and restart python server.py, then open http://127.0.0.1:8000/assistant.html.`
        );
    }
    let result;
    try {
        result = await response.json();
    } catch {
        throw new Error(`The server returned an invalid response (HTTP ${response.status}).`);
    }
    if (!response.ok) {
        const message = result && typeof result.error === 'string'
            ? result.error
            : `The server returned HTTP ${response.status}.`;
        throw new Error(message);
    }
    return result;
}

async function checkAssistantAccess() {
    try {
        const session = await requestJson('/api/auth/session');
        if (!session.authenticated) {
            location.replace('/');
            return;
        }
        const status = await requestJson('/api/assistant/status');
        if (status.configured) {
            setAssistantStatus(`${status.message} Your conversation is not saved.`);
        } else {
            setAssistantStatus(status.message || 'Ollama is not ready.', true);
        }
    } catch (error) {
        setAssistantStatus(error.message, true);
    }
}

questionForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (assistantBusy || !questionForm.reportValidity()) return;
    const message = questionInput.value.trim();
    if (!message) return;

    const history = conversation.slice(-10);
    conversation.push({ role: 'user', text: message });
    addMessage('user', message);
    questionInput.value = '';
    assistantBusy = true;
    sendButton.disabled = true;
    sendButton.textContent = 'Searching…';
    setAssistantStatus('Searching DuckDuckGo and asking local Ollama…');
    try {
        const result = await requestJson('/api/assistant/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, history })
        });
        if (typeof result.reply !== 'string' || !result.reply.trim()) {
            throw new Error('The assistant returned an empty reply. Please try again.');
        }
        const reply = result.reply.trim();
        const sources = Array.isArray(result.sources) ? result.sources : [];
        conversation.push({ role: 'model', text: reply });
        conversation = conversation.slice(-12);
        addMessage('model', reply, sources);
        setAssistantStatus('Ready for your next question.');
    } catch (error) {
        conversation.pop();
        setAssistantStatus(error.message, true);
    } finally {
        assistantBusy = false;
        sendButton.disabled = false;
        sendButton.textContent = 'Search & ask';
        questionInput.focus();
    }
});

checkAssistantAccess();
