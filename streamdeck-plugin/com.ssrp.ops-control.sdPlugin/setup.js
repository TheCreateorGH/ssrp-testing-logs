let settings = {};
const $ = id => document.getElementById(id);

function send(payload) {
  document.dispatchEvent(new CustomEvent('sendToPlugin', { detail: payload }));
  if (window.$SD) window.$SD.api.sendToPlugin(payload);
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
