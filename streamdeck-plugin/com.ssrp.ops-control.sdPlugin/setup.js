let settings = {};
const $ = id => document.getElementById(id);
let socket;
let inspectorUuid;
let actionInfo;
const listeners = new Map();

function emit(event, payload) {
  listeners.get(event)?.forEach(listener => listener({ payload }));
}

function sendMessage(event, payload = {}) {
  socket?.send(JSON.stringify({
    context: inspectorUuid,
    event,
    ...payload
  }));
}

window.$SD = {
  on(event, listener) {
    if (!listeners.has(event)) listeners.set(event, []);
    listeners.get(event).push(listener);
  },
  api: {
    getGlobalSettings() {
      sendMessage('getGlobalSettings');
    },
    sendToPlugin(payload) {
      sendMessage('sendToPlugin', {
        action: actionInfo?.action,
        payload
      });
    }
  }
};

function connectElgatoStreamDeckSocket(port, uuid, registerEvent, info, rawActionInfo) {
  inspectorUuid = uuid;
  actionInfo = typeof rawActionInfo === 'string' ? JSON.parse(rawActionInfo) : rawActionInfo;
  socket = new WebSocket(`ws://127.0.0.1:${port}`);
  socket.addEventListener('open', () => {
    sendMessage(registerEvent, { uuid: inspectorUuid });
    window.$SD.api.getGlobalSettings();
  });
  socket.addEventListener('message', event => {
    let message;
    try {
      message = JSON.parse(event.data);
    } catch {
      return;
    }
    if (message.event === 'didReceiveGlobalSettings') {
      emit('didReceiveGlobalSettings', message.payload);
    }
  });
}

function send(payload) {
  window.$SD.api.sendToPlugin(payload);
}

function render() {
  $('apiBaseUrl').value = settings.apiBaseUrl || '';
  $('label').value = settings.label || 'Stream Deck';
  $('status').textContent = settings.token ? 'Configured. The password is not stored.' : 'Not configured.';
}

document.addEventListener('DOMContentLoaded', () => {
  if (window.$SD) {
    window.$SD.on('didReceiveGlobalSettings', event => {
      settings = event.payload?.settings || {};
      render();
    });
    window.$SD.api.getGlobalSettings();
  }
  $('save').onclick = async () => {
    $('status').textContent = 'Signing in…';
    try {
      const base = $('apiBaseUrl').value.trim().replace(/\/+$/, '');
      const login = await fetch(`${base}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: $('username').value, password: $('password').value })
      });
      const session = await login.json();
      if (!login.ok) throw new Error(session.error || 'Login failed');
      const tokenResponse = await fetch(`${base}/api/auth/streamdeck-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Session-Token': session.token },
        body: JSON.stringify({ label: $('label').value })
      });
      const token = await tokenResponse.json();
      if (!tokenResponse.ok) throw new Error(token.error || 'Could not create device token');
      settings = { apiBaseUrl: base, token: token.token, label: $('label').value };
      send(settings);
      $('password').value = '';
      $('status').textContent = 'Saved. Future presses use the device token.';
    } catch (error) {
      $('status').textContent = error.message;
    }
  };
  $('clear').onclick = () => {
    settings = {};
    send(settings);
    render();
  };
});
