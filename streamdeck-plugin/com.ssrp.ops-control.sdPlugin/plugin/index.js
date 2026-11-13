const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const [port, pluginUUID, registerEvent] = process.argv.slice(2);
const ws = new WebSocket(`ws://127.0.0.1:${port}`);
const globalSettings = {};
const logFile = path.join(__dirname, '..', 'plugin.log');

function log(message) {
    try {
        fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${message}\n`);
    } catch (error) {
        console.error('[SSRP] Could not write plugin log:', error.message);
    }
}

const actions = {
    'com.ssrp.ops-control.alarm.none': { endpoint: '/api/control/alarm', body: { value: 'None' }, title: 'Alarm: None' },
    'com.ssrp.ops-control.alarm.class-d': { endpoint: '/api/control/alarm', body: { value: 'Class-D' }, title: 'Alarm: Class-D' },
    'com.ssrp.ops-control.alarm.chaos-insurgency': { endpoint: '/api/control/alarm', body: { value: 'Chaos Insurgency' }, title: 'Alarm: Chaos Insurgency' },
    'com.ssrp.ops-control.alarm.breach': { endpoint: '/api/control/alarm', body: { value: 'Breach' }, title: 'Alarm: Breach' },
    'com.ssrp.ops-control.alarm.site-lockdown': { endpoint: '/api/control/alarm', body: { value: 'Site Lockdown' }, title: 'Alarm: Site Lockdown' },
    'com.ssrp.ops-control.threat.low': { endpoint: '/api/control/threat', body: { value: 'Low' }, title: 'Threat: Low' },
    'com.ssrp.ops-control.threat.medium': { endpoint: '/api/control/threat', body: { value: 'Medium' }, title: 'Threat: Medium' },
    'com.ssrp.ops-control.threat.high': { endpoint: '/api/control/threat', body: { value: 'High' }, title: 'Threat: High' },
    'com.ssrp.ops-control.cdc.on': { endpoint: '/api/control/cdc', body: { value: 'On' }, title: 'CDC: On' },
    'com.ssrp.ops-control.cdc.off': { endpoint: '/api/control/cdc', body: { value: 'Off' }, title: 'CDC: Off' },
    'com.ssrp.ops-control.warhead.initialized': { endpoint: '/api/control/warhead', body: { action: 'initialized' }, title: 'Warhead: Initialize' },
    'com.ssrp.ops-control.warhead.surface-sealed': { endpoint: '/api/control/warhead', body: { action: 'surface_sealed' }, title: 'Warhead: Sealed' },
    'com.ssrp.ops-control.warhead.exploded': { endpoint: '/api/control/warhead', body: { action: 'exploded' }, title: 'Warhead: Detonate' },
    'com.ssrp.ops-control.warhead.autonuke': { endpoint: '/api/control/warhead', body: { action: 'autonuke' }, title: 'Warhead: Autonuke' }
};

function send(event, payload) {
    ws.send(JSON.stringify({ event, ...payload }));
}

function setTitle(context, title) {
    send('setTitle', { context, title, target: 0 });
}

function baseUrl() {
    return String(globalSettings.apiBaseUrl || '').replace(/\/+$/, '');
}

async function request(context, action) {
    if (!globalSettings.apiBaseUrl || !globalSettings.token) {
        log(`request skipped action=${action.title} apiBaseUrl=${baseUrl() || '(missing)'} tokenConfigured=${Boolean(globalSettings.token)}`);
        setTitle(context, 'Setup');
        return;
    }

    const response = await fetch(`${baseUrl()}${action.endpoint}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Session-Token': globalSettings.token
        },
        body: JSON.stringify(action.body)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(result.error || `HTTP ${response.status}`);
        error.status = response.status;
        throw error;
    }
    setTitle(context, 'Done');
    setTimeout(() => setTitle(context, action.title), 1600);
}

ws.on('open', () => {
    log(`connected; requesting global settings for ${pluginUUID}`);
    send(registerEvent, { uuid: pluginUUID });
    send('getGlobalSettings', { context: pluginUUID });
});

ws.on('message', async raw => {
    let message;
    try { message = JSON.parse(raw.toString()); } catch { return; }
    if (message.event === 'didReceiveGlobalSettings') {
        Object.assign(globalSettings, message.payload?.settings || {});
        log(`settings loaded; apiBaseUrl=${baseUrl() || '(missing)'} tokenConfigured=${Boolean(globalSettings.token)}`);
        return;
    }
    if (message.event === 'sendToPlugin') {
        Object.assign(globalSettings, message.payload || {});
        log(`settings updated; apiBaseUrl=${baseUrl() || '(missing)'} tokenConfigured=${Boolean(globalSettings.token)}`);
        send('setGlobalSettings', { context: pluginUUID, payload: globalSettings });
        return;
    }
    if (message.event !== 'keyDown') return;

    const action = actions[message.action];
    if (!action) return;
    try {
        log(`keyDown action=${message.action} apiBaseUrl=${baseUrl() || '(missing)'}`);
        await request(message.context, action);
    } catch (error) {
        const status = error.status ? `HTTP ${error.status}` : 'Error';
        setTitle(message.context, status);
        log(`request failed action=${message.action} status=${error.status || 'n/a'} message=${error.message}`);
        console.error('[SSRP]', error.message);
    }
});

ws.on('error', error => log(`websocket error message=${error.message}`));
