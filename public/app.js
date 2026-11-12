'use strict';

/* ═══════════════════════════════════════════════════════════════════════════
   ENVIRONMENT — API base resolution (works in browser, and inside the
   Capacitor WebView wrapper where relative URLs don't resolve to the
   packaged Node server).
   ═══════════════════════════════════════════════════════════════════════ */
let API_BASE = (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.protocol === 'capacitor:' ||
    (window.location.protocol === 'http:' && window.location.port !== '3000')
) ? 'http://127.0.0.1:3000' : '';

/** Identifies this browser tab so realtime broadcasts it caused itself
 *  can be applied without also popping a "new entry" toast at itself. */
const CLIENT_ID = (window.crypto && crypto.randomUUID)
    ? crypto.randomUUID()
    : `c-${Math.random().toString(36).slice(2)}${Date.now()}`;

/* ═══════════════════════════════════════════════════════════════════════════
   ROLES  (fetched from the server — /api/auth/roles — since clearance
   levels are backend-owned reference data, used only for display here:
   admin dropdowns, the role-override picker, etc.)
   ═══════════════════════════════════════════════════════════════════════ */
const Roles = {
    list: [], // [{code, name, clearance}, ...]
    async load() {
        try { this.list = await Api.req('GET', '/api/auth/roles', undefined, { skipQueue: true }); }
        catch { this.list = []; }
        return this.list;
    },
    clearanceOf(code) {
        const r = this.list.find(x => x.code === code);
        return r ? r.clearance : 0;
    }
};

/** Wildcard-aware permission match, mirroring src/services/permission
 *  .service.js's matches() exactly — grants may use '*' for either
 *  segment of a "VERB:NOUN" action, or '*'/'*:*' for everything. */
function matchesPermission(granted, action) {
    if (!Array.isArray(granted) || !action) return false;
    const [wantVerb, wantNoun] = String(action).split(':');
    return granted.some(g => {
        if (g === '*' || g === '*:*') return true;
        const [gv, gn] = String(g).split(':');
        const verbOk = gv === '*' || gv === wantVerb;
        const nounOk = gn === '*' || gn === wantNoun;
        return verbOk && nounOk;
    });
}

/* ═══════════════════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════════════ */

/** Quick-log timeline templates, grouped for the §4 Timeline Events panel.
 *  "Standard Procedure" covers the original test-log lifecycle events;
 *  the rest are lore-accurate incident templates (SCP Foundation canon +
 *  "SCP: Site Roleplay" conventions) so responders can log a fast-moving
 *  incident with one tap instead of typing it out manually. */
const TIMELINE_GROUPS = [
    {
        label: 'Standard Procedure', tone: '',
        events: ['Test started', 'Moved into C1', 'Moved into C2', 'Moved into CX', 'Moved into LCX', 'Entered chamber', 'Test done']
    },
    {
        label: 'Emergency & Security', tone: 'danger',
        events: ['Mass Class-D Riot', 'Chaos Insurgency Incursion', 'MTF Squad Deployed', 'Site-Wide Lockdown Initiated', 'Perimeter Breach Detected', 'Armed Contact Engaged']
    },
    {
        label: 'Ordnance & Evacuation', tone: 'warn',
        events: ['Warhead Activation Sequence', 'Non-Essential Personnel Withdrawn']
    },
    {
        label: 'Anomalous Activity', tone: 'danger',
        events: [
            'SCP-173 Blink Protocol Violation',
            'SCP-096 Emotional Agitation',
            'SCP-049 Plague Doctor Diagnosis',
            'SCP-106 Pocket Dimension Drag',
            'SCP-106 Teleportation',
            'SCP-076-2 Reanimation & Breach',
            'SCP-457 Thermodynamic Expansion',
            'SCP-939 Auditory Mimicry Lure',
            'SCP-914 Refinement Cycle Started',
            'SCP-035 Host Possession',
            'SCP-2521 Test Subject Abduction',
            'SCP-999 Euphoria Effect Triggered',
            'SCP-093 Mirror Portal Activation',
            'SCP-2006 Transformation'
        ]
    }
];

const ALARM_OPTS = [
    { v: 'None', l: 'alerts.none', tone: 'muted' },
    { v: 'Class-D', l: 'alerts.cd_alarm', tone: 'orange' },
    { v: 'Chaos Insurgency', l: 'alerts.ci_alarm', tone: 'green' },
    { v: 'Breach', l: 'alerts.breach', tone: 'red' },
    { v: 'Site Lockdown', l: 'alerts.lockdown', tone: 'blue' }
];
const THREAT_OPTS = [
    { v: 'Low', l: 'alerts.low', tone: 'green' },
    { v: 'Medium', l: 'alerts.medium', tone: 'yellow' },
    { v: 'High', l: 'alerts.high', tone: 'red' }
];
const CDC_OPTS = [
    // { v: 'Unknown', l: 'alerts.unknown', tone: 'muted' },
    { v: 'On', l: 'alerts.on', tone: 'red' },
    { v: 'Off', l: 'alerts.off', tone: 'green' }
];
const FINAL_STATUS_OPTS = [
    { v: 'Success', l: 'statuses.success', tone: 'green' },
    { v: 'Aborted', l: 'statuses.aborted', tone: 'yellow' },
    { v: 'Failed', l: 'statuses.failed', tone: 'red' }
];
const SUBSTATUS_MAP = {
    Success: ['CD back to CDC', 'CD Terminated', 'Other'],
    Aborted: ['Site Alarm', 'Other Breach', 'Security Risk', 'Technical Failure', 'Inactivity', 'Other'],
    Failed: ['SCP Breach', 'All Personnel Died', 'Researcher Died', 'Useless Test Data', 'Other']
};
const SUBSTATUS_TONE = { Success: 'green', Aborted: 'yellow', Failed: 'red' };

/** value -> chip tone suffix, shared by alarm/threat/cdc values (no key overlap) */
const ALERT_TONE = {
    'None': 'none', 'Class-D': 'cd', 'Chaos Insurgency': 'ci', 'Breach': 'breach', 'Site Lockdown': 'lockdown',
    'Low': 'low', 'Medium': 'medium', 'High': 'high',
    'Unknown': 'none', 'On': 'breach', 'Off': 'low'
};

const NUKE_KEYS = {
    initialized: { time: 'T-120s', tone: 'var(--caution)' },
    surface_sealed: { time: 'T-30s', tone: 'var(--access)' },
    exploded: { time: 'T-0s', tone: 'var(--signal)' },
    autonuke: { time: 'T-30s', tone: 'var(--cd)' }
};

const EQUIPMENT_LABELS = { scramblers: 'Scramblers', bag: 'Containment Bag', lavender: 'Lavender', cageNeeded: 'Cage' };

/* ═══════════════════════════════════════════════════════════════════════════
   I18N
   ═══════════════════════════════════════════════════════════════════════ */
const I18n = {
    lang: 'en',
    data: {},

    async init() {
        const params = new URLSearchParams(window.location.search);
        this.lang = params.get('lang') || 'en';
        try {
            const res = await fetch(`./locales/${this.lang}.json`);
            if (!res.ok) throw new Error(`Locale "${this.lang}" not found (HTTP ${res.status})`);
            this.data = await res.json();
        } catch (err) {
            console.warn(`Locale "${this.lang}" failed, falling back to "en".`, err);
            try {
                const res = await fetch('./locales/en.json');
                if (!res.ok) throw new Error(`English fallback failed (HTTP ${res.status})`);
                this.data = await res.json();
            } catch (fallbackErr) {
                SystemOverlay.show(fallbackErr, 'LOCALE_LOAD_ERROR', 'boot');
                throw fallbackErr;
            }
        }
        this.translatePage();
    },

    t(key, params = {}) {
        const keys = key.split('.');
        let val = this.data;
        for (const k of keys) {
            val = val && val[k];
            if (val === undefined) return key;
        }
        if (typeof val !== 'string') return key;
        for (const [pk, pv] of Object.entries(params)) val = val.replace(`{${pk}}`, pv);
        return val;
    },

    translatePage(root = document) {
        root.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') el.placeholder = this.t(key);
            else el.textContent = this.t(key);
        });
        document.title = this.t('app.title');
    }
};

/* ═══════════════════════════════════════════════════════════════════════════
   UTILITIES
   ═══════════════════════════════════════════════════════════════════════ */
function escHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function formatUtcFull(iso) {
    if (!iso) return '—';
    return iso.replace('T', ' ').slice(0, 19) + ' UTC';
}

function formatRelative(iso) {
    if (!iso) return '—';
    const diffMs = Date.now() - new Date(iso).getTime();
    const s = Math.floor(diffMs / 1000);
    if (s < 5) return 'just now';
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 30) return `${d}d ago`;
    return (iso.split('T')[0]) || '—';
}

function equipmentSummary(eq) {
    if (!eq) return I18n.t('alerts.none');
    const items = Object.entries(EQUIPMENT_LABELS).filter(([k]) => eq[k]).map(([, label]) => label);
    return items.length ? items.join(', ') : I18n.t('alerts.none');
}

function timelineLabel(eventText) {
    const key = 'timeline.' + String(eventText).toLowerCase().replace(/ /g, '_');
    const translated = I18n.t(key);
    return translated === key ? eventText : translated;
}

const AUDIT_PATTERNS = [
    { re: /^CD terminated by Security — Unit #(\d+)(?: — Reason: (.*))?$/, category: 'security' },
    { re: /^CD killed by SCP — Unit #(\d+)(?: — Reason: (.*))?$/, category: 'scp' },
    { re: /^Personnel \(SD\/MTF\/RRT\) lost — Unit #(\d+)(?: — Reason: (.*))?$/, category: 'personnel' }
];

/** Recovers {category, unitNum, reason, timestamp} from a manualLogs
 *  entry written by TerminationConfirm.appendAudit(), or null if the
 *  entry isn't a casualty-audit line (bug #2 fix support). */
function parseAuditEntry(entry) {
    for (const { re, category } of AUDIT_PATTERNS) {
        const m = entry.text.match(re);
        if (m) return { category, unitNum: m[1], reason: m[2] || '', timestamp: entry.timestamp };
    }
    return null;
}

/* ═══════════════════════════════════════════════════════════════════════════
   TOAST
   ═══════════════════════════════════════════════════════════════════════ */
const Toast = {
    show(msg, type = '') {
        const el = document.createElement('div');
        el.className = `toast${type ? ' toast--' + type : ''}`;
        el.textContent = msg;
        document.getElementById('toastStack').appendChild(el);
        setTimeout(() => el.remove(), 3000);
    }
};

/* ═══════════════════════════════════════════════════════════════════════════
   FAULT OVERLAY (connection failure)
   ═══════════════════════════════════════════════════════════════════════ */
const OVERLAY_KINDS = {
    connection: {
        tone: '--signal', toneGlow: '--signal-glow', icon: 'icon-plug', head: 'CORE CONNECTION FAULT',
        title: 'LINK TO SITE SERVER LOST',
        text: "The console can't reach the facility database. Confirm the server is running and reachable.",
        showAdvanced: true
    },
    unauthorized: {
        tone: '--caution', toneGlow: '--caution-glow', icon: 'icon-lock', head: 'AUTHENTICATION REQUIRED',
        title: 'SESSION NOT AUTHORIZED',
        text: 'Your session credentials were rejected (401). Sign in again to continue.',
        showAdvanced: false
    },
    forbidden: {
        tone: '--caution', toneGlow: '--caution-glow', icon: 'icon-lock', head: 'ACCESS DENIED',
        title: 'CLEARANCE INSUFFICIENT',
        text: 'The server rejected this request (403). Your account lacks clearance for this action.',
        showAdvanced: false
    },
    boot: {
        tone: '--signal', toneGlow: '--signal-glow', icon: 'icon-plug', head: 'SYSTEM BOOT FAILURE',
        title: 'CONSOLE FAILED TO INITIALIZE',
        text: 'An unexpected error occurred while starting the console.',
        showAdvanced: true
    }
};

const SystemOverlay = {
    currentKind: null,

    show(err, code = 'UNKNOWN_EXCEPTION', kind = 'connection') {
        const cfg = OVERLAY_KINDS[kind] || OVERLAY_KINDS.connection;
        this.currentKind = kind;
        document.getElementById('faultCard').style.setProperty('--tone', `var(${cfg.tone})`);
        document.getElementById('faultCard').style.setProperty('--tone-glow', `var(${cfg.toneGlow})`);
        document.getElementById('faultHead').textContent = cfg.head;
        document.getElementById('faultIcon').innerHTML = `<use href="#${cfg.icon}"/>`;
        document.getElementById('faultTitle').textContent = cfg.title;
        document.getElementById('faultText').textContent = cfg.text;
        document.getElementById('faultType').textContent = code;
        document.getElementById('faultMsg').textContent = (err && err.message) || String(err || '');
        document.getElementById('faultAdvancedToggleWrap').classList.toggle('hidden', !cfg.showAdvanced);
        document.getElementById('faultOverlay').classList.add('is-open');
    },
    hide() {
        document.getElementById('faultOverlay').classList.remove('is-open');
        this.currentKind = null;
    },
    isOpen() { return document.getElementById('faultOverlay').classList.contains('is-open'); },
    toggleAdvanced() {
        const adv = document.getElementById('faultAdvanced');
        adv.classList.toggle('is-open');
        if (adv.classList.contains('is-open')) {
            document.getElementById('faultIpInput').value = API_BASE || window.location.origin;
        }
    },
    applyBase() {
        const val = document.getElementById('faultIpInput').value.trim();
        if (val) {
            API_BASE = val;
            Toast.show(`API_BASE updated to: ${API_BASE}`, 'success');
            this.toggleAdvanced();
        }
    }
};

/* ═══════════════════════════════════════════════════════════════════════════
   API
   ═══════════════════════════════════════════════════════════════════════ */
const MUTATING_METHODS = new Set(['POST', 'PUT', 'DELETE']);

/* ═══════════════════════════════════════════════════════════════════════════
   SESSION  (Faction/clearance-aware login)
   ═══════════════════════════════════════════════════════════════════════ */
const SESSION_STORAGE_KEY = 'ssrp_session';

const Session = {
    token: null, userId: null, username: null, name: null,
    roleCode: null, roleName: null, clearance: 0, mustChangePassword: false,
    permissions: [],
    _rememberMe: false,

    isActive() { return !!this.token; },
    isAdmin() { return this.roleCode === 'ADMIN'; },

    /** Remember Me decides where the token lives: localStorage survives
     *  a full browser restart, sessionStorage only survives reloads
     *  within the same tab/session (cleared when the browser closes). */
    set(session, rememberMe = false) {
        Object.assign(this, session);
        this._rememberMe = !!rememberMe;
        const payload = JSON.stringify({ ...session, _rememberMe: this._rememberMe });
        try {
            if (rememberMe) { localStorage.setItem(SESSION_STORAGE_KEY, payload); sessionStorage.removeItem(SESSION_STORAGE_KEY); }
            else { sessionStorage.setItem(SESSION_STORAGE_KEY, payload); localStorage.removeItem(SESSION_STORAGE_KEY); }
        } catch { /* storage may be unavailable (private mode) */ }
    },

    loadPersisted() {
        try {
            const raw = sessionStorage.getItem(SESSION_STORAGE_KEY) || localStorage.getItem(SESSION_STORAGE_KEY);
            if (raw) { Object.assign(this, JSON.parse(raw)); return true; }
        } catch { /* ignore malformed/unavailable storage */ }
        return false;
    },

    clear() {
        this.token = null; this.userId = null; this.username = null; this.name = null;
        this.roleCode = null; this.roleName = null; this.clearance = 0; this.mustChangePassword = false;
        this.permissions = [];
        try { localStorage.removeItem(SESSION_STORAGE_KEY); sessionStorage.removeItem(SESSION_STORAGE_KEY); } catch { /* ignore */ }
    },

    /** Called when the server rejects our token (expired/invalid) —
     *  drops the session and returns the user to the login screen. */
    forceLogout() {
        this.clear();
        Views.showLogin();
    },

    /** Granular, per-action check against this session's *effective*
     *  permissions (role default, role override, or user override —
     *  already resolved server-side and handed to us at login/whoami).
     *  Every action is checked individually; there is no blanket
     *  role→allowed-list mirror on the client anymore. */
    can(action) {
        return matchesPermission(this.permissions, action);
    },

    /** Clearance levels this session is allowed to assign to a log's
     *  viewClearance field (rule #2 — never higher than your own). */
    assignableClearances() {
        const levels = [];
        for (let i = 0; i <= this.clearance; i++) levels.push(i);
        return levels;
    }
};

/* ═══════════════════════════════════════════════════════════════════════════
   OFFLINE QUEUE  (advanced feature — queues mutations made while the
   heartbeat/SSE has flagged the connection as down, and replays them in
   order once connectivity is confirmed restored)
   ═══════════════════════════════════════════════════════════════════════ */
const OFFLINE_QUEUE_KEY = 'ssrp_offline_queue';

const OfflineQueue = {
    _flushing: false,

    _read() {
        try { return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]'); }
        catch { return []; }
    },

    _write(queue) {
        try { localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue)); } catch { /* ignore */ }
    },

    size() { return this._read().length; },

    /** Queues a mutation and returns an optimistic response so calling
     *  code (LogForm.submit, Dashboard.deleteLog, etc.) can proceed as
     *  if the request had succeeded, instead of blocking the user. */
    enqueue(method, path, body) {
        const queue = this._read();
        const entry = { qid: `${Date.now()}-${Math.random().toString(36).slice(2)}`, method, path, body, queuedAt: new Date().toISOString() };
        queue.push(entry);
        this._write(queue);
        Toast.show(`Offline — action queued (${queue.length} pending)`, 'warning');
        this._renderOptimistic(method, path, body);
        return this._optimisticResult(method, path, body);
    },

    /** Applies the mutation to local state immediately so the UI
     *  reflects it, even though the server hasn't seen it yet. */
    _renderOptimistic(method, path, body) {
        if (method === 'POST' && path === '/api/logs') {
            S.logs.unshift({ ...body, id: body.id || `pending-${Date.now()}`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), survivalRate: 100, _pendingSync: true });
        } else if (method === 'DELETE' && path.startsWith('/api/logs/')) {
            const id = path.split('/').pop();
            S.logs = S.logs.filter(l => l.id !== id);
        } else if (method === 'POST' && path === '/api/events') {
            S.events.unshift({ ...body, id: `pending-${Date.now()}`, createdAt: new Date().toISOString(), _pendingSync: true });
        } else if (method === 'DELETE' && path.startsWith('/api/events/')) {
            const id = path.split('/').pop();
            S.events = S.events.filter(e => e.id !== id);
        }
        if (document.getElementById('view-dashboard')?.classList.contains('is-active')) Dashboard.render();
    },

    _optimisticResult(method, path, body) {
        if (method === 'POST') return { ...body, id: body.id || `pending-${Date.now()}`, _pendingSync: true };
        return { queued: true };
    },

    /** Replays every queued mutation in order against the real API.
     *  Stops at the first failure (keeping the remainder queued) so a
     *  fresh drop mid-flush doesn't lose anything. */
    async flush() {
        if (this._flushing) return;
        const queue = this._read();
        if (!queue.length) return;
        this._flushing = true;
        let processed = 0;
        for (const entry of queue) {
            try {
                await Api.req(entry.method, entry.path, entry.body, { skipQueue: true });
                processed++;
            } catch {
                break; // leave this and remaining entries queued for next reconnect
            }
        }
        if (processed > 0) {
            const remaining = queue.slice(processed);
            this._write(remaining);
            Toast.show(`Synced ${processed} queued action${processed === 1 ? '' : 's'}${remaining.length ? ` — ${remaining.length} still pending` : ''}`, 'success');
        }
        this._flushing = false;
    }
};

const Api = {
    async req(method, path, body, opts_ = {}) {
        // Advanced feature: offline-first queue. If the heartbeat has
        // already detected a drop, don't even attempt a doomed fetch for
        // writes — queue it and let OfflineQueue.flush() replay it once
        // Heartbeat/SSE confirm the connection is back.
        if (MUTATING_METHODS.has(method) && !Heartbeat.isOnline && !opts_.skipQueue) {
            return OfflineQueue.enqueue(method, path, body);
        }

        const opts = { method, headers: { 'Content-Type': 'application/json', 'X-Client-Id': CLIENT_ID } };
        if (Session.token) opts.headers['X-Session-Token'] = Session.token;
        if (body !== undefined) opts.body = JSON.stringify(body);

        let res;
        try {
            res = await fetch(`${API_BASE}${path}`, opts);
        } catch (err) {
            Heartbeat.reportFailure();
            if (MUTATING_METHODS.has(method) && !opts_.skipQueue) return OfflineQueue.enqueue(method, path, body);
            SystemOverlay.show(
                new Error(`Unable to reach the site server at ${API_BASE || window.location.origin}. Confirm the facility network connection (VPN/Tailscale) and that the server process is active.`),
                'CONNECTION_REFUSED', 'connection'
            );
            throw err;
        }
        Heartbeat.reportSuccess();

        let data = null;
        try { data = await res.json(); } catch { /* empty body is fine for some responses */ }

        if (res.status === 401) {
            const msg = (data && data.error) || 'Your session is invalid or has expired.';
            Toast.show(msg, 'error');
            SystemOverlay.show(new Error(msg), 'UNAUTHORIZED', 'unauthorized');
            Session.forceLogout();
            throw new Error(msg);
        }
        if (res.status === 403) {
            const msg = (data && data.error) || 'You are not authorized to perform this action.';
            Toast.show(msg, 'error');
            SystemOverlay.show(new Error(msg), 'FORBIDDEN', 'forbidden');
            throw new Error(msg);
        }
        if (!res.ok) {
            const err = new Error((data && data.error) || `HTTP ${res.status}`);
            Toast.show(err.message, 'error');
            throw err;
        }
        return data;
    },
    getScps: () => Api.req('GET', '/api/scps'),
    getSettings: () => Api.req('GET', '/api/settings'),
    getLogs: () => Api.req('GET', '/api/logs'),
    getLog: id => Api.req('GET', `/api/logs/${id}`),
    createLog: payload => Api.req('POST', '/api/logs', payload),
    updateLog: (id, payload) => Api.req('PUT', `/api/logs/${id}`, payload),
    deleteLog: id => Api.req('DELETE', `/api/logs/${id}`),
    getEvents: () => Api.req('GET', '/api/events'),
    createEvent: payload => Api.req('POST', '/api/events', payload),
    deleteEvent: id => Api.req('DELETE', `/api/events/${id}`),
    importLog: content => Api.req('POST', '/api/import', { content }),

    listRoles: () => Api.req('GET', '/api/auth/roles', undefined, { skipQueue: true }),
    login: (name, role) => Api.req('POST', '/api/auth/login', { name, role }, { skipQueue: true }),
    whoami: () => Api.req('GET', '/api/auth/whoami', undefined, { skipQueue: true }),
    logout: () => Api.req('POST', '/api/auth/logout', undefined, { skipQueue: true }),

    listSchedules: () => Api.req('GET', '/api/schedules'),
    createSchedule: payload => Api.req('POST', '/api/schedules', payload),
    deleteSchedule: id => Api.req('DELETE', `/api/schedules/${id}`),

    assessCrossTest: scps => Api.req('POST', '/api/cross-test/assess', { scps }, { skipQueue: true }),

    register: (username, password, displayName) => Api.req('POST', '/api/auth/register', { username, password, displayName }, { skipQueue: true }),
    changePassword: (oldPassword, newPassword) => Api.req('POST', '/api/auth/change-password', { oldPassword, newPassword }, { skipQueue: true }),

    adminListUsers: () => Api.req('GET', '/api/admin/users', undefined, { skipQueue: true }),
    adminUpdateUser: (id, payload) => Api.req('PUT', `/api/admin/users/${id}`, payload, { skipQueue: true }),
    adminResetPassword: id => Api.req('POST', `/api/admin/users/${id}/reset-password`, undefined, { skipQueue: true }),
    adminDeleteUser: id => Api.req('DELETE', `/api/admin/users/${id}`, undefined, { skipQueue: true }),

    listLogSessions: () => Api.req('GET', '/api/log-sessions', undefined, { skipQueue: true }),
    createLogSession: () => Api.req('POST', '/api/log-sessions'),

    getContainmentOverrides: () => Api.req('GET', '/api/containment', undefined, { skipQueue: true }),
    setContainmentStatus: (scp, status) => Api.req('PUT', `/api/containment/${scp}`, { status }),

    adminGetPermissionCatalog: () => Api.req('GET', '/api/admin/permissions/catalog', undefined, { skipQueue: true }),
    adminGetRolePermissions: role => Api.req('GET', `/api/admin/permissions/roles/${role}`, undefined, { skipQueue: true }),
    adminSetRolePermissions: (role, permissions) => Api.req('PUT', `/api/admin/permissions/roles/${role}`, { permissions }, { skipQueue: true }),
    adminResetRolePermissions: role => Api.req('POST', `/api/admin/permissions/roles/${role}/reset`, undefined, { skipQueue: true }),
    adminGetUserPermissions: id => Api.req('GET', `/api/admin/permissions/users/${id}`, undefined, { skipQueue: true }),
    adminSetUserPermissions: (id, permissions) => Api.req('PUT', `/api/admin/permissions/users/${id}`, { permissions }, { skipQueue: true }),
    adminResetUserPermissions: id => Api.req('POST', `/api/admin/permissions/users/${id}/reset`, undefined, { skipQueue: true })
};

/* ═══════════════════════════════════════════════════════════════════════════
   HEARTBEAT  (advanced feature #1 — proactive connection monitoring,
   independent of whatever the user happens to be doing)
   ═══════════════════════════════════════════════════════════════════════ */
const Heartbeat = {
    _timer: null,
    _consecutiveFailures: 0,
    _intervalMs: 8000,
    isOnline: true,

    start() {
        this._ping();
        this._timer = setInterval(() => this._ping(), this._intervalMs);
    },

    async _ping() {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        try {
            // Deliberately hits a public, unauthenticated endpoint —
            // /api/settings now requires a session, and pinging it
            // without one would always read as "down" even when the
            // server is perfectly healthy.
            const res = await fetch(`${API_BASE}/api/auth/roles`, { signal: controller.signal });
            clearTimeout(timeout);
            if (res.ok) this.reportSuccess();
            else this.reportFailure();
        } catch {
            clearTimeout(timeout);
            this.reportFailure();
        }
    },

    reportFailure() {
        this._consecutiveFailures += 1;
        this.isOnline = false;
        RealtimeFeed.markReconnecting();
        // "As soon as possible" — surface the overlay on the very first
        // miss rather than waiting for a streak, unless some other fault
        // kind (401/403) is already being shown.
        if (!SystemOverlay.isOpen()) {
            SystemOverlay.show(
                new Error(`Unable to reach the site server at ${API_BASE || window.location.origin}.`),
                'HEARTBEAT_TIMEOUT', 'connection'
            );
        }
    },

    async reportSuccess() {
        const wasDown = !this.isOnline || SystemOverlay.currentKind === 'connection';
        this._consecutiveFailures = 0;
        this.isOnline = true;
        if (SystemOverlay.currentKind === 'connection') SystemOverlay.hide();
        if (wasDown) {
            await OfflineQueue.flush();
            try { await loadAll(); applySettings(); Dashboard.render(); StatusStrip.syncAll(); Toast.show('Connection restored', 'success'); }
            catch { /* a fresh failure will be reported by the next heartbeat/request */ }
        }
    }
};

/* ═══════════════════════════════════════════════════════════════════════════
   STORE
   ═══════════════════════════════════════════════════════════════════════ */
const INITIAL_WORKING_STATE = {
    scp: '', sector: '',
    timeline: [], manualLogs: [],
    startAlarmLevel: 'None', startThreatLevel: 'Low', startCDCAlert: 'Off',
    currentAlarmLevel: 'None', currentThreatLevel: 'Low', currentCDCAlert: 'Off',
    finalStatus: 'Success', finalSubStatus: '',
    termSec: 0, termScp: 0, persLost: 0,
    requiredClearance: 1, location: 'c1',
    viewClearance: 0, roleOverrides: [], crossScps: []
};

const S = {
    logs: [], events: [], scps: {}, settings: {},
    currentId: null, editMode: false,
    w: JSON.parse(JSON.stringify(INITIAL_WORKING_STATE)),
    timer: { interval: null, startTime: null, running: false },
    dashboard: { sort: 'newest' }
};

async function loadAll() {
    [S.logs, S.scps, S.events, S.settings] = await Promise.all([
        Api.getLogs(), Api.getScps(), Api.getEvents(), Api.getSettings()
    ]);
}

function applySettings() {
    if (S.settings.site_title) {
        document.getElementById('brandTitle').textContent = S.settings.site_title.replace(/^☣\s*/, '');
        document.title = S.settings.site_title;
    }
    if (S.settings.site_sub_logo) document.getElementById('brandSub').textContent = S.settings.site_sub_logo;
}

/* ═══════════════════════════════════════════════════════════════════════════
   MODAL (generic controller)
   ═══════════════════════════════════════════════════════════════════════ */
const Modal = {
    current: null,
    open(name) {
        if (this.current) this.close(this.current);
        const el = document.getElementById(`modal-${name}`);
        if (!el) return;
        el.classList.add('is-open');
        this.current = name;
    },
    close(name) {
        const id = name || this.current;
        if (!id) return;
        const el = document.getElementById(`modal-${id}`);
        if (el) el.classList.remove('is-open');
        if (this.current === id) this.current = null;
    },
    closeTop() { if (this.current) this.close(this.current); }
};

/* ═══════════════════════════════════════════════════════════════════════════
   CONFIRM DIALOG
   ═══════════════════════════════════════════════════════════════════════ */
const ConfirmDialog = {
    _resolve: null,
    ask(message, sub = '') {
        document.getElementById('confirmMsg').textContent = message;
        document.getElementById('confirmSub').textContent = sub;
        Modal.open('confirm');
        return new Promise(resolve => { this._resolve = resolve; });
    },
    resolve(value) {
        Modal.close('confirm');
        if (this._resolve) { this._resolve(value); this._resolve = null; }
    }
};

/* ═══════════════════════════════════════════════════════════════════════════
   DRAWER (Ops Console)
   ═══════════════════════════════════════════════════════════════════════ */
const Drawer = {
    open() {
        document.getElementById('opsDrawer').classList.add('is-open');
        document.getElementById('scrim').classList.add('is-open');
        document.getElementById('opsDrawer').setAttribute('aria-hidden', 'false');
        OpsConsole.applyPermissionGating();
    },
    close() {
        document.getElementById('opsDrawer').classList.remove('is-open');
        document.getElementById('scrim').classList.remove('is-open');
        document.getElementById('opsDrawer').setAttribute('aria-hidden', 'true');
    },
    toggle() {
        document.getElementById('opsDrawer').classList.contains('is-open') ? this.close() : this.open();
    },
    isOpen() { return document.getElementById('opsDrawer').classList.contains('is-open'); }
};

/* ═══════════════════════════════════════════════════════════════════════════
   SEGMENTED CONTROL (shared component)
   ═══════════════════════════════════════════════════════════════════════ */
function renderSeg({ group, options, value, size = '' }) {
    const cls = `seg${size ? ' seg--' + size : ''}`;
    return `<div class="${cls}" data-seg-group="${escHtml(group)}">${options.map(o => `
    <button type="button" class="seg__btn${value === o.v ? ' is-active' : ''}"
      data-action="seg-pick" data-group="${escHtml(group)}" data-value="${escHtml(o.v)}" data-tone="${o.tone}">
      ${o.l ? escHtml(I18n.t(o.l)) : escHtml(o.v)}
    </button>`).join('')}</div>`;
}

function renderNumSeg({ field, max, value }) {
    let html = `<div class="seg seg--num" data-num-field="${escHtml(field)}">`;
    for (let i = 0; i <= max; i++) {
        html += `<button type="button" class="seg__btn${value === i ? ' is-active' : ''}" data-action="num-pick" data-field="${escHtml(field)}" data-value="${i}">${i}</button>`;
    }
    return html + '</div>';
}

function syncSeg(group, value) {
    document.querySelectorAll(`[data-seg-group="${CSS.escape(group)}"] .seg__btn`).forEach(btn => {
        btn.classList.toggle('is-active', btn.dataset.value === value);
    });
}

/* ═══════════════════════════════════════════════════════════════════════════
   SCP PICKER  (shared by the main form and the breach modal)
   ═══════════════════════════════════════════════════════════════════════ */
const ScpPicker = {
    _focusIdx: { main: -1, breach: -1 },

    _ids(mode) {
        const map = {
            breach: { input: 'breachScpSearch', drop: 'breachAutocomplete' },
            schedule: { input: 'scheduleScpSearch', drop: 'scheduleAutocomplete' },
            cross: { input: 'crossScpSearch', drop: 'crossScpAutocomplete' }
        };
        return map[mode] || { input: 'scpSearchInput', drop: 'scpAutocomplete' };
    },

    /** Positions the dropdown as position:fixed against the input's own
     *  bounding box, so it renders above modal content and is never
     *  clipped by an ancestor's overflow:auto/hidden (bug #1). */
    _position(mode) {
        const { input, drop } = this._ids(mode);
        const inputEl = document.getElementById(input);
        const dropEl = document.getElementById(drop);
        const rect = inputEl.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const maxHeight = Math.max(140, Math.min(260, spaceBelow - 12));
        dropEl.classList.add('is-fixed');
        dropEl.style.left = `${rect.left}px`;
        dropEl.style.width = `${rect.width}px`;
        dropEl.style.maxHeight = `${maxHeight}px`;
        if (spaceBelow < 160 && rect.top > spaceBelow) {
            // Not enough room below — flip above the input instead.
            dropEl.style.top = 'auto';
            dropEl.style.bottom = `${window.innerHeight - rect.top + 6}px`;
        } else {
            dropEl.style.bottom = 'auto';
            dropEl.style.top = `${rect.bottom + 6}px`;
        }
    },

    close(mode) {
        const { drop } = this._ids(mode);
        document.getElementById(drop).classList.add('hidden');
        this._focusIdx[mode] = -1;
    },

    closeAll() { this.close('main'); this.close('breach'); this.close('schedule'); this.close('cross'); },

    filter(mode) {
        const { input, drop } = this._ids(mode);
        const q = document.getElementById(input).value.trim().toLowerCase();
        const dropEl = document.getElementById(drop);
        if (!q) { this.close(mode); return; }

        const matches = Object.entries(S.scps)
            .filter(([num, d]) => num.includes(q) || (d.name || '').toLowerCase().includes(q) || `scp-${num}`.includes(q))
            .slice(0, 10);

        if (!matches.length) { this.close(mode); return; }

        dropEl.innerHTML = matches.map(([num, d]) => `
      <div class="picker-item" data-action="pick-scp" data-mode="${mode}" data-num="${escHtml(num)}">
        <div><span class="picker-item__num">SCP-${escHtml(num)}</span>${d.name ? `<span class="picker-item__name">${escHtml(d.name)}</span>` : ''}</div>
        <span class="class-tag class-tag--${escHtml(d.class || '')}">${escHtml((d.class || '').toUpperCase())}</span>
      </div>`).join('');
        this._position(mode);
        dropEl.classList.remove('hidden');
        this._focusIdx[mode] = -1;
    },

    keyNav(mode, e) {
        const { drop } = this._ids(mode);
        const dropEl = document.getElementById(drop);
        const items = dropEl.querySelectorAll('.picker-item');
        if (dropEl.classList.contains('hidden') || !items.length) {
            if (e.key === 'Enter') this._trySelectTyped(mode);
            return;
        }
        if (e.key === 'ArrowDown') { e.preventDefault(); this._focusIdx[mode] = Math.min(this._focusIdx[mode] + 1, items.length - 1); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); this._focusIdx[mode] = Math.max(this._focusIdx[mode] - 1, 0); }
        else if (e.key === 'Enter') {
            e.preventDefault();
            const focused = this._focusIdx[mode] >= 0 ? items[this._focusIdx[mode]] : items[0];
            if (focused) this.select(mode, focused.dataset.num);
            return;
        } else if (e.key === 'Escape') { this.close(mode); return; }
        items.forEach((it, i) => it.classList.toggle('is-focused', i === this._focusIdx[mode]));
    },

    _trySelectTyped(mode) {
        const { input } = this._ids(mode);
        const q = document.getElementById(input).value.trim().replace(/^scp-?/i, '');
        if (S.scps[q]) this.select(mode, q);
    },

    select(mode, num) {
        const data = S.scps[num];
        if (!data) return;
        this.close(mode);

        if (mode === 'breach') {
            OpsConsole.breachSelectedScp = num;
            document.getElementById('breachScpSearch').value = `SCP-${num}`;
            const cls = (data.class || '').toLowerCase();
            document.getElementById('breachSelectedInfo').innerHTML = `
        <div class="identity identity--${cls}" style="padding:var(--sp-3);gap:var(--sp-3)">
          <div class="identity__num" style="font-size:22px">SCP-${escHtml(num)}</div>
          <div class="identity__name" style="font-size:13px;margin-bottom:0">${escHtml(data.name || '')}</div>
        </div>`;
            return;
        }

        if (mode === 'schedule') { Scheduling.pickScp(num); return; }
        if (mode === 'cross') { CrossTest.add(num); document.getElementById('crossScpSearch').value = ''; return; }

        S.w.scp = num;
        S.w.requiredClearance = data.clearance;
        S.w.location = data.location;
        document.getElementById('scpSearchInput').value = `SCP-${num} — ${data.name || ''}`;
        LogForm.updateClearance();
        this.renderIdentity(num, data);
    },

    renderIdentity(num, data) {
        const cls = (data.class || '').toLowerCase();
        const sector = data.sector ? `${I18n.t('detail.sector')} — ${escHtml(data.sector)}` : '';
        document.getElementById('scpIdentityBlock').innerHTML = `
      <div class="identity identity--${cls}">
        <div class="identity__num"><span class="chevron">›</span>SCP-${escHtml(num)}</div>
        <div>
          <div class="identity__name">${escHtml(data.name || '')}</div>
          <div class="identity__class ${cls}">${escHtml(cls.toUpperCase())}</div>
          <div class="identity__meta">
            ${sector ? `<span><span class="dot"></span>${sector}</span>` : ''}
            <span><span class="dot"></span>${I18n.t('detail.clearance')} ${data.clearance}</span>
            <span><span class="dot"></span>${escHtml((data.location || '').toUpperCase())}</span>
          </div>
        </div>
      </div>`;
        document.getElementById('scpClassDisplay').innerHTML = `<span class="class-tag class-tag--${cls}">${escHtml(cls.toUpperCase())}</span>`;
    },

    clear() {
        document.getElementById('scpSearchInput').value = '';
        document.getElementById('scpIdentityBlock').innerHTML = '';
        document.getElementById('scpClassDisplay').innerHTML = '';
        this.close('main');
        S.w.scp = '';
    }
};

/* ═══════════════════════════════════════════════════════════════════════════
   ALERT PANEL  (start / live alarm-threat-cdc rows + status strip sync)
   ═══════════════════════════════════════════════════════════════════════ */
const AlertPanel = {
    ROWS: [
        { field: 'Alarm', opts: ALARM_OPTS, labelKey: 'field.alarm_level' },
        { field: 'Threat', opts: THREAT_OPTS, labelKey: 'field.threat_level' },
        { field: 'CDC', opts: CDC_OPTS, labelKey: 'field.cdc_alert' }
    ],

    renderStartRows() {
        document.getElementById('startAlertRows').innerHTML = this.ROWS.map(r => `
      <div class="alert-row">
        <span class="alert-row__label">${I18n.t(r.labelKey)}</span>
        ${renderSeg({ group: `start-${r.field.toLowerCase()}`, options: r.opts, value: S.w[`start${r.field}Level`] ?? S.w[`start${r.field}Alert`] })}
      </div>`).join('');
    },

    renderLiveRows() {
        document.getElementById('liveAlertRows').innerHTML = this.ROWS.map(r => `
      <div class="alert-row">
        <span class="alert-row__label">${I18n.t(r.labelKey)}</span>
        ${renderSeg({ group: `live-${r.field.toLowerCase()}`, options: r.opts, value: S.w[`current${r.field}Level`] ?? S.w[`current${r.field}Alert`] })}
      </div>`).join('');
        this.refreshLiveIndicator();
    },

    fieldKeyFor(kind, phase) {
        // kind: alarm|threat|cdc, phase: start|current
        if (kind === 'cdc') return `${phase}CDCAlert`;
        const cap = kind.charAt(0).toUpperCase() + kind.slice(1);
        return `${phase}${cap}Level`;
    },

    pick(group, value) {
        const [phase, kind] = group.split('-'); // "start"/"live", "alarm"/"threat"/"cdc"
        if (phase === 'start') {
            S.w[this.fieldKeyFor(kind, 'start')] = value;
            syncSeg(group, value);
            if (!S.timer.running) {
                S.w[this.fieldKeyFor(kind, 'current')] = value;
                syncSeg(`live-${kind}`, value);
                StatusStrip.update(kind, value);
            }
            return;
        }
        // phase === 'live'
        const key = this.fieldKeyFor(kind, 'current');
        if (S.w[key] === value) return;
        S.w[key] = value;
        syncSeg(group, value);
        StatusStrip.update(kind, value);
        if (S.timer.running) {
            const labelKey = { alarm: 'field.alarm_level', threat: 'field.threat_level', cdc: 'field.cdc_alert' }[kind];
            Timeline.addEvent(I18n.t('timeline.changed', { field: I18n.t(labelKey).toUpperCase(), value }), 'alert');
        }
    },

    syncLiveFromStart() {
        S.w.currentAlarmLevel = S.w.startAlarmLevel;
        S.w.currentThreatLevel = S.w.startThreatLevel;
        S.w.currentCDCAlert = S.w.startCDCAlert;
        syncSeg('live-alarm', S.w.currentAlarmLevel);
        syncSeg('live-threat', S.w.currentThreatLevel);
        syncSeg('live-cdc', S.w.currentCDCAlert);
        StatusStrip.update('alarm', S.w.currentAlarmLevel);
        StatusStrip.update('threat', S.w.currentThreatLevel);
        StatusStrip.update('cdc', S.w.currentCDCAlert);
    },

    refreshLiveIndicator() {
        const running = S.timer.running;
        document.querySelectorAll('#liveAlertRows .seg__btn').forEach(b => { b.disabled = false; });
        document.getElementById('liveDot').classList.toggle('is-idle', !running);
        document.getElementById('liveStatusText').textContent = running ? I18n.t('live.active_hint') : I18n.t('live.idle_hint');
        document.getElementById('livePanel').classList.toggle('is-active', running);
    }
};

/* ═══════════════════════════════════════════════════════════════════════════
   STATUS STRIP  (signature element — live site status readout + clock)
   ═══════════════════════════════════════════════════════════════════════ */
const STATUS_TONE_VAR = {
    none: '--text-dim', cd: '--cd', ci: '--clear', breach: '--signal', lockdown: '--access',
    low: '--clear', medium: '--caution', high: '--signal'
};

const StatusStrip = {
    update(kind, value) {
        const segMap = { alarm: 'stripAlarmSeg', threat: 'stripThreatSeg', cdc: 'stripCdcSeg' };
        const valMap = { alarm: 'stripAlarmVal', threat: 'stripThreatVal', cdc: 'stripCdcVal' };
        const seg = document.getElementById(segMap[kind]);
        const valEl = document.getElementById(valMap[kind]);
        valEl.textContent = value;
        const tone = STATUS_TONE_VAR[ALERT_TONE[value] || 'none'];
        seg.style.color = `var(${tone})`;
        seg.classList.remove('is-flash');
        // eslint-disable-next-line no-unused-expressions
        seg.offsetWidth; // restart animation
        seg.classList.add('is-flash');
    },

    syncAll() {
        const latestOf = type => S.events
            .filter(e => e.type === type)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null;
        const extractQuoted = status => { const m = status && status.match(/'([^']+)'/); return m ? m[1] : null; };

        const alarmEv = latestOf('ALARM');
        const threatEv = latestOf('THREAT');
        const cdcEv = latestOf('CDC');

        const alarmVal = alarmEv ? (extractQuoted(alarmEv.status) || 'None') : 'None';
        const threatVal = threatEv ? (extractQuoted(threatEv.status) || 'Low') : 'Low';
        const cdcVal = cdcEv ? cdcEv.status : 'Unknown';

        S.w.currentAlarmLevel = alarmVal;
        S.w.currentThreatLevel = threatVal;
        S.w.currentCDCAlert = cdcVal;

        this.update('alarm', alarmVal);
        this.update('threat', threatVal);
        this.update('cdc', cdcVal);
    },

    startClock() {
        const tick = () => {
            const now = new Date().toISOString();
            document.getElementById('statusClock').textContent = now.slice(11, 19) + ' Z';
        };
        tick();
        setInterval(tick, 1000);
    }
};

/* ═══════════════════════════════════════════════════════════════════════════
   TIMER
   ═══════════════════════════════════════════════════════════════════════ */
const Timer = {
    start() {
        if (S.timer.running) return;
        const now = new Date().toISOString();
        S.timer.startTime = now;
        S.timer.running = true;

        AlertPanel.syncLiveFromStart();
        AlertPanel.refreshLiveIndicator();
        Timeline.addEvent('Test started', 'start');

        document.querySelector('.tl-btn[data-event="Test started"]')?.classList.add('is-fired');
        document.getElementById('btnStartTest').classList.add('hidden');
        document.getElementById('btnStopTest').classList.remove('hidden');
        document.getElementById('timerDisplay').classList.add('is-running');
        document.getElementById('timerStatus').textContent = I18n.t('live.in_progress');
        document.getElementById('timerStartedAt').textContent = `${I18n.t('live.started_at')} ${formatUtcFull(now)}`;

        S.timer.interval = setInterval(() => this._tick(), 1000);
        this._tick();
    },

    stop() {
        if (!S.timer.running) return;
        S.timer.running = false;
        clearInterval(S.timer.interval);
        S.timer.interval = null;

        Timeline.addEvent('Test stopped', 'end');
        AlertPanel.refreshLiveIndicator();

        document.getElementById('timerDisplay').classList.remove('is-running');
        document.getElementById('timerStatus').textContent = I18n.t('live.stopped');
        document.getElementById('btnStopTest').classList.add('hidden');
        document.getElementById('btnStartTest').classList.remove('hidden');
        document.getElementById('btnStartTest').lastChild.textContent = I18n.t('live.resume_test');
    },

    reset() {
        this.stop();
        clearInterval(S.timer.interval);
        S.timer = { interval: null, startTime: null, running: false };
        document.getElementById('timerDisplay').textContent = '00:00';
        document.getElementById('timerDisplay').classList.remove('is-running');
        document.getElementById('timerStatus').textContent = I18n.t('live.awaiting');
        document.getElementById('timerStartedAt').textContent = '';
        document.getElementById('btnStartTest').lastChild.textContent = I18n.t('live.start_test');
        document.getElementById('btnStopTest').classList.add('hidden');
        document.getElementById('btnStartTest').classList.remove('hidden');
        document.querySelectorAll('.tl-btn').forEach(b => {
            b.classList.remove('is-fired');
            b.disabled = Timeline.isStandardEvent(b.dataset.event);
        });
        AlertPanel.refreshLiveIndicator();
    },

    _tick() {
        if (!S.timer.startTime) return;
        const sec = Math.floor((Date.now() - new Date(S.timer.startTime)) / 1000);
        const mm = String(Math.floor(sec / 60)).padStart(2, '0');
        const ss = String(sec % 60).padStart(2, '0');
        document.getElementById('timerDisplay').textContent = `${mm}:${ss}`;
    }
};

/* ═══════════════════════════════════════════════════════════════════════════
   TIMELINE
   ═══════════════════════════════════════════════════════════════════════ */
const Timeline = {
    renderButtons() {
        document.getElementById('timelineButtons').innerHTML = TIMELINE_GROUPS.map(group => `
      <div class="tl-group">
        <div class="tl-group__label">${escHtml(group.label)}</div>
        <div class="tl-btn-grid">
          ${group.events.map(ev => `<button type="button" class="tl-btn${group.tone ? ' tl-btn--' + group.tone : ''}" data-action="log-timeline-event" data-event="${escHtml(ev)}"${group.label === 'Standard Procedure' ? ' disabled' : ''}>${escHtml(timelineLabel(ev))}</button>`).join('')}
        </div>
      </div>`).join('');
    },

    isStandardEvent(text) { return TIMELINE_GROUPS[0].events.includes(text); },

    addEvent(eventText, type = 'event', ts) {
        const timestamp = ts || new Date().toISOString();
        if (type === 'manual') {
            S.w.manualLogs.push({ text: eventText, timestamp });
        } else {
            S.w.timeline.push({ event: eventText, timestamp, type });
            if (type === 'event' && this.isStandardEvent(eventText)) {
                const btn = document.querySelector(`.tl-btn[data-event="${CSS.escape(eventText)}"]`);
                if (btn) { btn.disabled = false; btn.classList.add('is-fired'); btn.disabled = true; }
            } else if (type === 'event') {
                Toast.show(I18n.t('toasts.entry_logged'), 'success');
            }
            if (eventText === 'Test started') {
                document.querySelectorAll('.tl-btn').forEach(b => { if (!b.classList.contains('is-fired')) b.disabled = false; });
            }
        }
        this.renderFeed();
    },

    addManual() {
        const input = document.getElementById('fManualEntry');
        const text = input.value.trim();
        if (!text) return;
        this.addEvent(text, 'manual');
        input.value = '';
        Toast.show(I18n.t('toasts.entry_logged'), 'success');
    },

    _combined() {
        return [
            ...S.w.timeline.map(e => e.type ? e : { ...e, type: 'event' }),
            ...S.w.manualLogs.map(e => ({ event: e.text, timestamp: e.timestamp, type: 'manual' }))
        ].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    },

    renderFeed() {
        const feed = document.getElementById('activityFeed');
        const all = this._combined();
        if (!all.length) { feed.innerHTML = `<div class="feed-empty">${I18n.t('dashboard.no_entries')}</div>`; return; }
        feed.innerHTML = all.map(e => {
            const ts = new Date(e.timestamp).toISOString().slice(11, 19);
            return `<div class="feed-entry feed-entry--${e.type}"><span class="feed-entry__ts">[${ts}]</span><span class="feed-entry__text">${escHtml(timelineLabel(e.event))}</span></div>`;
        }).join('');
        feed.scrollTop = feed.scrollHeight;
    }
};

/* ═══════════════════════════════════════════════════════════════════════════
   CASUALTIES
   ═══════════════════════════════════════════════════════════════════════ */
const Casualties = {
    renderAll() {
        const cd = parseInt(document.getElementById('fCd').value) || 0;
        const sd = parseInt(document.getElementById('fSd').value) || 0;
        const mtf = parseInt(document.getElementById('fMtf').value) || 0;
        const rrt = parseInt(document.getElementById('fRrt').value) || 0;
        const persMax = sd + mtf + rrt;

        S.w.termSec = Math.min(S.w.termSec, cd);
        S.w.termScp = Math.min(S.w.termScp, cd - S.w.termSec);
        S.w.persLost = Math.min(S.w.persLost, persMax);

        document.getElementById('segTermSec').innerHTML = renderNumSeg({ field: 'termSec', max: cd, value: S.w.termSec });
        document.getElementById('segTermScp').innerHTML = renderNumSeg({ field: 'termScp', max: cd - S.w.termSec, value: S.w.termScp });
        document.getElementById('segPersonnelLost').innerHTML = renderNumSeg({ field: 'persLost', max: persMax, value: S.w.persLost });

        document.getElementById('capSecUsed').textContent = `${S.w.termSec} / ${cd}`;
        document.getElementById('capScpUsed').textContent = `${S.w.termScp} / ${cd}`;
        document.getElementById('capPersMax').textContent = `${S.w.persLost} / ${persMax}`;

        this.updateSurvivalDisplay();
    },

    setField(field, value) {
        if (S.w[field] === value) return;
        const wasRunning = S.timer.running;
        S.w[field] = value;
        if (wasRunning && field === 'termSec') Timeline.addEvent(I18n.t('timeline.termed_security', { val: value }), 'termed');
        if (wasRunning && field === 'termScp') Timeline.addEvent(I18n.t('timeline.termed_scp', { val: value }), 'termed');
        this.renderAll();
    },

    computeRate() {
        const cd = parseInt(document.getElementById('fCd').value) || 0;
        const sd = parseInt(document.getElementById('fSd').value) || 0;
        const mtf = parseInt(document.getElementById('fMtf').value) || 0;
        const rrt = parseInt(document.getElementById('fRrt').value) || 0;
        const total = cd + sd + mtf + rrt;
        if (!total) return 100;
        const lost = S.w.termSec + S.w.termScp + S.w.persLost;
        return Math.round(((total - Math.min(lost, total)) / total) * 100);
    },

    updateSurvivalDisplay() {
        const rate = this.computeRate();
        const color = rate >= 75 ? 'var(--clear)' : rate >= 40 ? 'var(--caution)' : 'var(--signal)';
        document.getElementById('survivalPct').textContent = `${rate}%`;
        document.getElementById('survivalPct').style.color = color;
        document.getElementById('survivalBar').style.width = `${rate}%`;
        document.getElementById('survivalBar').style.background = color;
    }
};

/* ═══════════════════════════════════════════════════════════════════════════
   LOG FORM  (create / edit)
   ═══════════════════════════════════════════════════════════════════════ */
const LogForm = {
    renderFinalStatusBar() {
        document.getElementById('finalStatusBar').innerHTML = renderSeg({ group: 'final-status', options: FINAL_STATUS_OPTS, value: S.w.finalStatus, size: 'lg' });
    },

    setFinalStatus(value) {
        S.w.finalStatus = value;
        S.w.finalSubStatus = '';
        syncSeg('final-status', value);
        this.renderSubStatusBar(value);
    },

    renderSubStatusBar(status) {
        const section = document.getElementById('subStatusSection');
        const opts = SUBSTATUS_MAP[status];
        if (!opts || !opts.length) { section.classList.add('hidden'); return; }
        section.classList.remove('hidden');
        document.getElementById('subStatusBar').innerHTML = renderSeg({
            group: 'sub-status',
            options: opts.map(o => ({ v: o, l: 'substatus.' + o, tone: SUBSTATUS_TONE[status] || 'muted' })),
            value: S.w.finalSubStatus
        });
    },

    setSubStatus(value) { S.w.finalSubStatus = value; syncSeg('sub-status', value); },

    updateClearance() {
        const level = parseInt(S.w.requiredClearance) || 0;
        let html = '';
        for (let i = 1; i <= 5; i++) html += `<div class="clearance__dot${i <= level ? ' is-active' : ''}" data-level="${i}"></div>`;
        html += `<span class="clearance__text">${I18n.t('detail.clearance')} ${level}</span>`;
        document.getElementById('clearanceBar').innerHTML = html;
    },

    updateSignature() {
        const name = document.getElementById('fResearcher').value || 'N/A';
        const rank = document.getElementById('fRank').value || 'N/A';
        const date = new Date().toISOString().split('T')[0];
        document.getElementById('sigBlock').innerHTML = `
      <span class="sig-block__line">Signed: <span class="sig-block__name">Researcher ${escHtml(name)}</span>
      &nbsp;|&nbsp; ${escHtml(rank)} &nbsp;|&nbsp; <span style="color:var(--text-dim)">${date}</span></span>`;
    },

    buildPayload() {
        return {
            scp: S.w.scp,
            requiredClearance: S.w.requiredClearance,
            location: S.w.location,
            equipment: {
                scramblers: document.getElementById('fScramblers').checked,
                bag: document.getElementById('fBag').checked,
                lavender: document.getElementById('fLavender').checked,
                cageNeeded: document.getElementById('fCage').checked
            },
            researcherName: document.getElementById('fResearcher').value.trim(),
            researcherRank: document.getElementById('fRank').value.trim(),
            ethicsObserver: document.getElementById('fEthics').checked,
            personnel: {
                cd: parseInt(document.getElementById('fCd').value) || 0,
                sd: parseInt(document.getElementById('fSd').value) || 0,
                mtf: parseInt(document.getElementById('fMtf').value) || 0,
                rrt: parseInt(document.getElementById('fRrt').value) || 0
            },
            startAlarmLevel: S.w.startAlarmLevel,
            startThreatLevel: S.w.startThreatLevel,
            startCDCAlert: S.w.startCDCAlert,
            endAlarmLevel: S.w.currentAlarmLevel,
            endThreatLevel: S.w.currentThreatLevel,
            endCDCAlert: S.w.currentCDCAlert,
            timeline: S.w.timeline,
            manualLogs: S.w.manualLogs,
            casualties: { terminatedBySecurity: S.w.termSec, killedBySCP: S.w.termScp, personnelLost: S.w.persLost },
            finalStatus: S.w.finalStatus,
            finalSubStatus: S.w.finalSubStatus,
            notes: document.getElementById('fNotes').value.trim(),
            viewClearance: S.w.viewClearance || 0,
            roleOverrides: S.w.roleOverrides || [],
            crossScps: S.w.crossScps || []
        };
    },

    async submit() {
        if (!S.w.scp) { Toast.show(I18n.t('toasts.select_scp'), 'error'); return; }
        if (!document.getElementById('fResearcher').value.trim()) { Toast.show(I18n.t('toasts.enter_name'), 'error'); return; }

        if (TerminationConfirm.hasCasualties()) {
            const reason = await TerminationConfirm.ask();
            if (reason === null) return; // user cancelled — do not submit
            TerminationConfirm.appendAudit(reason);
        }

        const payload = this.buildPayload();
        try {
            if (S.editMode && S.currentId) {
                await Api.updateLog(S.currentId, payload);
                Toast.show(I18n.t('toasts.log_updated'), 'success');
            } else {
                await Api.createLog(payload);
                Toast.show(I18n.t('toasts.log_submitted'), 'success');
            }
            Timer.reset();
            await Views.showDashboard();
        } catch { /* toast already shown by Api */ }
    },

    async saveDraft() {
        const payload = this.buildPayload();
        if (!payload.scp) { Toast.show(I18n.t('toasts.select_scp'), 'error'); return; }
        try {
            if (S.editMode && S.currentId) {
                await Api.updateLog(S.currentId, payload);
            } else {
                const saved = await Api.createLog(payload);
                S.currentId = saved.id;
                S.editMode = true;
            }
            Toast.show(I18n.t('toasts.draft_saved'), 'success');
        } catch { /* toast already shown by Api */ }
    },

    fill(log) {
        if (log.scp && S.scps[log.scp]) {
            document.getElementById('scpSearchInput').value = `SCP-${log.scp} — ${S.scps[log.scp].name || ''}`;
            ScpPicker.renderIdentity(log.scp, S.scps[log.scp]);
        }
        S.w.scp = log.scp || '';
        S.w.requiredClearance = log.requiredClearance || 0;
        S.w.location = log.location || 'c1';

        document.getElementById('fScramblers').checked = !!log.equipment?.scramblers;
        document.getElementById('fBag').checked = !!log.equipment?.bag;
        document.getElementById('fLavender').checked = !!log.equipment?.lavender;
        document.getElementById('fCage').checked = !!log.equipment?.cageNeeded;
        document.getElementById('fResearcher').value = log.researcherName || '';
        document.getElementById('fRank').value = log.researcherRank || '';
        document.getElementById('fCd').value = log.personnel?.cd ?? 1;
        document.getElementById('fSd').value = log.personnel?.sd ?? 2;
        document.getElementById('fMtf').value = log.personnel?.mtf ?? 2;
        document.getElementById('fRrt').value = log.personnel?.rrt ?? 0;
        document.getElementById('fEthics').checked = !!log.ethicsObserver;
        document.getElementById('fNotes').value = log.notes || '';

        S.w.startAlarmLevel = log.startAlarmLevel || 'None';
        S.w.startThreatLevel = log.startThreatLevel || 'Low';
        S.w.startCDCAlert = log.startCDCAlert || 'Unknown';
        S.w.currentAlarmLevel = log.endAlarmLevel || 'None';
        S.w.currentThreatLevel = log.endThreatLevel || 'Low';
        S.w.currentCDCAlert = log.endCDCAlert || 'Unknown';
        S.w.finalStatus = log.finalStatus || 'Success';
        S.w.finalSubStatus = log.finalSubStatus || '';
        S.w.timeline = log.timeline || [];
        S.w.manualLogs = log.manualLogs || [];
        S.w.termSec = log.casualties?.terminatedBySecurity ?? 0;
        S.w.termScp = log.casualties?.killedBySCP ?? 0;
        S.w.persLost = log.casualties?.personnelLost ?? 0;
        S.w.viewClearance = log.viewClearance ?? 0;
        S.w.roleOverrides = [...(log.roleOverrides || [])];

        this.updateClearance();
        Casualties.renderAll();
        this.updateSignature();
        this.renderFinalStatusBar();
        this.renderSubStatusBar(S.w.finalStatus);
        Timeline.renderFeed();
    },

    clearFields() {
        S.w = JSON.parse(JSON.stringify(INITIAL_WORKING_STATE));
        ScpPicker.clear();
        document.getElementById('fScramblers').checked = false;
        document.getElementById('fBag').checked = false;
        document.getElementById('fLavender').checked = false;
        document.getElementById('fCage').checked = false;
        document.getElementById('fResearcher').value = S.settings.default_researcher_name || '';
        document.getElementById('fRank').value = S.settings.default_researcher_rank || '';
        document.getElementById('fCd').value = '1';
        document.getElementById('fSd').value = '2';
        document.getElementById('fMtf').value = '2';
        document.getElementById('fRrt').value = '0';
        document.getElementById('fEthics').checked = false;
        document.getElementById('fNotes').value = '';
        this.updateClearance();
        Casualties.renderAll();
        this.updateSignature();
        this.renderFinalStatusBar();
        this.renderSubStatusBar('Success');
        Timeline.renderFeed();
    },

    /** Populates the "Required Clearance to View" select, capped to the
     *  session's own clearance (rule #2 — enforced again server-side). */
    renderClearanceOptions() {
        const sel = document.getElementById('fViewClearance');
        sel.innerHTML = Session.assignableClearances()
            .map(n => `<option value="${n}">${n} ${n === 0 ? '(Any staff)' : ''}</option>`).join('');
        sel.value = String(S.w.viewClearance || 0);
        sel.onchange = () => { S.w.viewClearance = parseInt(sel.value) || 0; };
    },

    /** Role-override checkboxes — grants specific roles access to a log
     *  regardless of their base clearance (rule #3). */
    renderRoleOverrideGrid() {
        const grid = document.getElementById('roleOverrideGrid');
        grid.innerHTML = Roles.list.map(({ code, clearance }) => `
      <label class="check-item" style="padding:6px 10px">
        <input type="checkbox" data-role-override="${code}" ${S.w.roleOverrides.includes(code) ? 'checked' : ''}>
        <div class="check-box"></div>
        <span class="check-item__label" style="font-size:11px">${code} <span style="color:var(--text-dim)">(L${clearance})</span></span>
      </label>`).join('');
        grid.querySelectorAll('[data-role-override]').forEach(cb => {
            cb.addEventListener('change', () => {
                const code = cb.dataset.roleOverride;
                S.w.roleOverrides = cb.checked
                    ? [...new Set([...S.w.roleOverrides, code])]
                    : S.w.roleOverrides.filter(r => r !== code);
            });
        });
    }
};

/* ═══════════════════════════════════════════════════════════════════════════
   CROSS-TEST CORRELATION  (multi-SCP concurrent testing + live
   contamination risk assessment)
   ═══════════════════════════════════════════════════════════════════════ */
const CrossTest = {
    _lastAssessment: [],

    reset() {
        S.w.crossScps = [];
        this._lastAssessment = [];
        document.getElementById('crossScpSearch').value = '';
        this.renderChips();
        this.renderWarnings();
    },

    fill(log) {
        S.w.crossScps = [...(log.crossScps || [])];
        this._lastAssessment = log.crossContamination || [];
        this.renderChips();
        this.renderWarnings(true);
    },

    add(num) {
        if (num === S.w.scp || S.w.crossScps.includes(num)) return;
        if (!S.scps[num]) return;
        S.w.crossScps.push(num);
        this.renderChips();
        this.assess();
    },

    remove(num) {
        S.w.crossScps = S.w.crossScps.filter(n => n !== num);
        this.renderChips();
        this.assess();
    },

    renderChips() {
        document.getElementById('crossScpChips').innerHTML = S.w.crossScps.map(num => `
      <span class="removable-chip">SCP-${escHtml(num)}<span class="removable-chip__x" data-action="remove-cross-scp" data-num="${escHtml(num)}"><svg class="icon icon--sm"><use href="#icon-x"/></svg></span></span>
    `).join('');
    },

    async assess() {
        if (!S.w.scp || !S.w.crossScps.length) { this._lastAssessment = []; this.renderWarnings(); return; }
        try {
            const { pairs } = await Api.assessCrossTest([S.w.scp, ...S.w.crossScps]);
            this._lastAssessment = pairs;
        } catch {
            this._lastAssessment = [];
        }
        this.renderWarnings();
    },

    renderWarnings() {
        const el = document.getElementById('crossContaminationWarnings');
        if (!this._lastAssessment.length) { el.innerHTML = ''; return; }
        el.innerHTML = this._lastAssessment.map(p => `
      <div class="cross-warning cross-warning--${p.risk}">
        <span class="cross-warning__tag">${escHtml(p.risk)}</span>
        <span class="cross-warning__body"><strong>SCP-${escHtml(p.scpA)} × SCP-${escHtml(p.scpB)}</strong> — ${escHtml(p.reason)}</span>
      </div>`).join('');
    }
};

/* ═══════════════════════════════════════════════════════════════════════════
   DASHBOARD
   ═══════════════════════════════════════════════════════════════════════ */
const Dashboard = {
    computeStats() {
        const total = S.logs.length;
        const success = total ? Math.round((S.logs.filter(l => l.finalStatus === 'Success').length / total) * 100) : 0;
        const avgSurvival = total ? Math.round(S.logs.reduce((sum, l) => sum + (l.survivalRate ?? 100), 0) / total) : 0;
        const activeBreaches = OpsConsole.getActiveBreaches().length;
        document.getElementById('statTotal').textContent = total;
        document.getElementById('statSuccess').textContent = `${success}%`;
        document.getElementById('statBreaches').textContent = activeBreaches;
        document.getElementById('statSurvival').textContent = `${avgSurvival}%`;
    },

    _filtered() {
        const search = document.getElementById('filterSearch').value.toLowerCase();
        const status = document.getElementById('filterStatus').value;
        const cls = document.getElementById('filterClass').value;
        const alarm = document.getElementById('filterAlarm').value;
        const breachOnly = document.getElementById('filterBreachOnly').checked;

        const logs = S.logs.filter(l => {
            const scp = S.scps[l.scp] || {};
            const nameHit = `scp-${l.scp} ${l.researcherName} ${scp.name || ''}`.toLowerCase().includes(search);
            const statHit = !status || l.finalStatus === status;
            const clsHit = !cls || scp.class === cls;
            const alarmHit = !alarm || l.endAlarmLevel === alarm || l.startAlarmLevel === alarm;
            const breachHit = !breachOnly || l.finalSubStatus === 'SCP Breach';
            return nameHit && statHit && clsHit && alarmHit && breachHit;
        }).map(l => ({ ...l, _type: 'log' }));

        const events = S.events.filter(ev => {
            const scp = S.scps[ev.scp] || {};
            const nameHit = `scp-${ev.scp} ${ev.researcherName} ${scp.name || ''}`.toLowerCase().includes(search);
            const statHit = !status || ev.type === status || (status === 'Failed' && ev.type === 'BREACH');
            const clsHit = !cls || scp.class === cls;
            const alarmHit = !alarm || (alarm === 'Breach' && ev.type === 'BREACH');
            const breachHit = !breachOnly || ['BREACH', 'CDC_RIOT', 'BREACH_END'].includes(ev.type);
            return nameHit && statHit && clsHit && alarmHit && breachHit;
        }).map(ev => ({ ...ev, _type: 'event' }));

        const combined = [...logs, ...events];
        const sort = S.dashboard.sort;
        combined.sort((a, b) => {
            if (sort === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt);
            if (sort === 'survival-desc') return (b.survivalRate ?? -1) - (a.survivalRate ?? -1);
            if (sort === 'survival-asc') return (a.survivalRate ?? 101) - (b.survivalRate ?? 101);
            return new Date(b.createdAt) - new Date(a.createdAt);
        });
        return combined;
    },

    async render() {
        this.computeStats();
        OpsConsole.refreshBreachIndicator();
        await FacilitySession.load();

        const combined = this._filtered();
        document.getElementById('resultCount').textContent = I18n.t('dashboard.results', { count: combined.length });

        const grid = document.getElementById('logGrid');
        if (!combined.length) {
            const filtered = !!(document.getElementById('filterSearch').value || document.getElementById('filterStatus').value ||
                document.getElementById('filterClass').value || document.getElementById('filterAlarm').value || document.getElementById('filterBreachOnly').checked);
            grid.innerHTML = `<div class="empty-state">
        <svg class="icon"><use href="#icon-inbox"/></svg>
        <div class="empty-state__title">${filtered ? I18n.t('dashboard.empty_title_filtered') : I18n.t('dashboard.empty_title')}</div>
        <div class="empty-state__hint">${filtered ? I18n.t('dashboard.empty_hint_filtered') : I18n.t('dashboard.empty_hint')}</div>
      </div>`;
            return;
        }

        const groups = {};
        combined.forEach(item => {
            const sid = item.sessionId || '__none__';
            (groups[sid] = groups[sid] || []).push(item);
        });

        const collapsed = FacilitySession.getCollapsed();
        const sessionMeta = new Map(FacilitySession.list.map(s => [s.id, s]));
        const orderedIds = Object.keys(groups).sort((a, b) => {
            if (a === '__none__') return 1;
            if (b === '__none__') return -1;
            const sa = sessionMeta.get(a), sb = sessionMeta.get(b);
            if (sa?.active && !sb?.active) return -1;
            if (sb?.active && !sa?.active) return 1;
            return new Date(sb?.createdAt || 0) - new Date(sa?.createdAt || 0);
        });

        grid.innerHTML = orderedIds.map(sid => {
            const meta = sessionMeta.get(sid);
            const items = groups[sid];
            const label = meta ? meta.label : 'Unassigned (legacy)';
            const isCollapsed = collapsed.has(sid);
            return `<div class="session-group${isCollapsed ? ' is-collapsed' : ''}" data-session-id="${escHtml(sid)}">
        <div class="session-group__head" data-action="toggle-session-group" data-session-id="${escHtml(sid)}">
          <svg class="icon icon--sm session-group__chevron"><use href="#icon-chevron-down"/></svg>
          <span class="session-group__title">${escHtml(label)}</span>
          ${meta?.active ? '<span class="session-group__active-tag">Active</span>' : ''}
          <span class="session-group__meta">${items.length} entries${meta ? ' · started ' + formatRelative(meta.createdAt) : ''}</span>
        </div>
        <div class="grid">${items.map(item => item._type === 'log' ? this._logCard(item) : this._eventCard(item)).join('')}</div>
      </div>`;
        }).join('');
    },

    _logCard(log) {
        const scp = S.scps[log.scp] || {};
        const status = (log.finalStatus || 'unknown').toLowerCase();
        const surv = log.survivalRate ?? 100;
        const survColor = surv >= 75 ? 'var(--clear)' : surv >= 40 ? 'var(--caution)' : 'var(--signal)';
        const chip = (val) => (val && !['None', 'Low', 'Unknown'].includes(val))
            ? `<span class="chip chip--${ALERT_TONE[val] || 'none'}">${val === 'Chaos Insurgency' ? 'C.I.' : escHtml(val)}</span>` : '';

        return `
    <article class="record-card record-card--${status}" tabindex="0" data-action="open-log" data-id="${escHtml(log.id)}">
      <div class="record-card__top">
        <span class="record-card__designator">SCP-${escHtml(log.scp || '???')}${log._elevatedAccess ? ` <span class="elevated-badge" title="Visible via role-override, not base clearance"><svg class="icon icon--sm"><use href="#icon-lock"/></svg>ELEVATED</span>` : ''}</span>
        <div class="record-card__badges">
          ${scp.class ? `<span class="class-tag class-tag--${scp.class}">${escHtml(scp.class.toUpperCase())}</span>` : ''}
          <span class="status-tag status-tag--${status}">${I18n.t('statuses.' + status)}${log.finalSubStatus ? ` — ${I18n.t('substatus.' + log.finalSubStatus)}` : ''}</span>
        </div>
      </div>
      <div class="record-card__body">
        <div class="record-card__meta">
          <strong>${escHtml(log.researcherName || '—')}</strong>${log.researcherRank ? ` · ${escHtml(log.researcherRank)}` : ''}<br>
          ${formatRelative(log.createdAt)} · ${escHtml((log.location || '').toUpperCase())} · CL ${log.requiredClearance} ·
          <span style="color:${survColor}">${I18n.t('detail.survival_short')} ${surv}%</span>
        </div>
        <div class="badge-row">
          <span class="pbadge pbadge--cd">CD ${log.personnel?.cd || 0}</span>
          <span class="pbadge pbadge--sd">SD ${log.personnel?.sd || 0}</span>
          <span class="pbadge pbadge--mtf">MTF ${log.personnel?.mtf || 0}</span>
          <span class="pbadge pbadge--rrt">RRT ${log.personnel?.rrt || 0}</span>
        </div>
        <div class="chip-row">
          ${chip(log.endAlarmLevel)}
          ${log.endThreatLevel !== 'Low' ? `<span class="chip chip--${ALERT_TONE[log.endThreatLevel]}">${I18n.t('field.threat_level').toUpperCase()}: ${escHtml(log.endThreatLevel)}</span>` : ''}
          ${log.endCDCAlert !== 'Unknown' ? `<span class="chip chip--${ALERT_TONE[log.endCDCAlert]}">CDC: ${escHtml(log.endCDCAlert)}</span>` : ''}
        </div>
      </div>
      <div class="record-card__foot">
        ${Session.can('EDIT:TEST') ? `<button class="btn btn--ghost btn--xs" data-action="edit-log" data-id="${escHtml(log.id)}"><svg class="icon icon--sm"><use href="#icon-edit"/></svg></button>` : ''}
        ${Session.can('EXPORT:TEST') ? `<button class="btn btn--ghost btn--xs" data-action="export-log" data-id="${escHtml(log.id)}"><svg class="icon icon--sm"><use href="#icon-download"/></svg></button>` : ''}
        ${Session.can('DELETE:TEST') ? `<button class="btn btn--danger btn--xs" data-action="delete-log" data-id="${escHtml(log.id)}"><svg class="icon icon--sm"><use href="#icon-trash"/></svg></button>` : ''}
      </div>
    </article>`;
    },

    _eventCard(ev) {
        const type = (ev.type || 'EVENT').toLowerCase();
        const scp = S.scps[ev.scp] || {};
        const iconMap = { WARHEAD: 'icon-warhead', BREACH: 'icon-alert-triangle', CDC_RIOT: 'icon-activity', BREACH_END: 'icon-check-circle', BROADCAST: 'icon-radio' };
        const icon = iconMap[ev.type] || 'icon-bell';

        return `
    <article class="record-card record-card--${type}" tabindex="0">
      <div class="record-card__top">
        <span class="record-card__designator" style="font-size:14px;display:flex;align-items:center;gap:6px"><svg class="icon icon--sm"><use href="#${icon}"/></svg>${escHtml(ev.type)}</span>
        <span class="status-tag status-tag--solid status-tag--${type}">${escHtml(ev.type)}</span>
      </div>
      <div class="record-card__body">
        <div class="record-card__meta"><strong>${escHtml(ev.researcherName || '—')}</strong> · ${escHtml(ev.researcherRank || '')}<br>${formatRelative(ev.createdAt)}</div>
        <div class="record-card__event-text">${escHtml(ev.status || '')}</div>
        ${(ev.type === 'BREACH' || ev.type === 'BREACH_END') && ev.scp ? `<div class="badge-row"><span class="pbadge">SCP-${escHtml(ev.scp)} ${escHtml(scp.name || '')}</span></div>` : ''}
      </div>
      <div class="record-card__foot">
        ${['BREACH', 'BREACH_END', 'CDC_RIOT'].includes(ev.type) ? `<button class="btn btn--ghost btn--xs" data-action="pdf-event" data-id="${escHtml(ev.id)}"><svg class="icon icon--sm"><use href="#icon-download"/></svg>PDF</button>` : ''}
        <button class="btn btn--danger btn--xs" data-action="delete-event" data-id="${escHtml(ev.id)}" style="margin-left:auto"><svg class="icon icon--sm"><use href="#icon-trash"/></svg></button>
      </div>
    </article>`;
    },

    async deleteLog(id) {
        const ok = await ConfirmDialog.ask(I18n.t('confirm.delete_log_msg'), I18n.t('confirm.delete_log_sub'));
        if (!ok) return;
        try {
            await Api.deleteLog(id);
            Toast.show(I18n.t('toasts.log_deleted'));
            await loadAll();
            this.render();
        } catch { /* toast already shown */ }
    },

    async deleteEvent(id) {
        const ok = await ConfirmDialog.ask(I18n.t('confirm.delete_event_msg'), I18n.t('confirm.delete_event_sub'));
        if (!ok) return;
        try {
            const ev = S.events.find(e => e.id === id);
            let linkedId = null;
            if (ev && ['BREACH', 'CDC_RIOT', 'BREACH_END'].includes(ev.type)) {
                linkedId = ev.linkedEventId || S.events.find(e => e.type === 'BREACH_END' && e.linkedEventId === id)?.id || null;
            }
            await Api.deleteEvent(id);
            if (linkedId) await Api.deleteEvent(linkedId);
            Toast.show(I18n.t('toasts.event_deleted'));
            await loadAll();
            this.render();
        } catch { /* toast already shown */ }
    },

    exportLog(id) {
        const a = document.createElement('a');
        a.href = `${API_BASE}/api/logs/${id}/export`;
        a.click();
    }
};

/* ═══════════════════════════════════════════════════════════════════════════
   DETAIL / REPORT VIEW
   ═══════════════════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════════════════════
   CONTAINMENT STATUS BOARD  (derived live from events + logs, not
   manually tracked — uses the same S.scps roster as every dropdown)
   ═══════════════════════════════════════════════════════════════════════ */
const ContainmentBoard = {
    overrides: {},

    async loadOverrides() {
        try { this.overrides = await Api.getContainmentOverrides(); }
        catch { this.overrides = {}; }
    },

    computeStatus(scpNum) {
        const override = this.overrides[scpNum];

        const activeBreach = OpsConsole.getActiveBreaches().find(b => String(b.scp) === String(scpNum));
        if (activeBreach && (!override || new Date(activeBreach.createdAt) > new Date(override.setAt))) return 'breached';

        const logsForScp = S.logs
            .filter(l => l.scp === scpNum || (l.crossScps || []).includes(scpNum))
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        const latestLog = logsForScp[0];
        const logSaysInvestigation = latestLog && ['Aborted', 'Failed'].includes(latestLog.finalStatus);
        if (logSaysInvestigation && (!override || new Date(latestLog.createdAt) > new Date(override.setAt))) return 'investigation';

        if (override) return override.status === 'breached' ? 'breached' : 'secure';
        return 'secure';
    },

    async render() {
        await this.loadOverrides();
        const search = document.getElementById('boardSearch').value.toLowerCase();
        const statusFilter = document.getElementById('boardStatusFilter').value;

        const rows = Object.entries(S.scps).map(([num, data]) => ({
            num, data, status: this.computeStatus(num)
        })).filter(r => {
            const nameHit = `scp-${r.num} ${r.data.name || ''}`.toLowerCase().includes(search);
            const statusHit = !statusFilter || r.status === statusFilter;
            return nameHit && statusHit;
        }).sort((a, b) => a.num.localeCompare(b.num));

        document.getElementById('boardResultCount').textContent = `${rows.length} subjects`;

        const statusLabel = { secure: 'Secure', investigation: 'Under Investigation', breached: 'Breached' };
        const grid = document.getElementById('boardGrid');
        if (!rows.length) {
            grid.innerHTML = `<div class="empty-state"><svg class="icon"><use href="#icon-inbox"/></svg><div class="empty-state__title">No matching subjects</div></div>`;
            return;
        }
        grid.innerHTML = rows.map(r => `
      <div class="containment-card containment-card--${r.status}" data-action="board-open-scp" data-scp="${escHtml(r.num)}">
        <div class="containment-card__top">
          <span class="containment-card__num">SCP-${escHtml(r.num)}</span>
          ${r.data.class ? `<span class="class-tag class-tag--${escHtml(r.data.class)}">${escHtml(r.data.class.toUpperCase())}</span>` : ''}
        </div>
        <div class="containment-card__name">${escHtml(r.data.name || '')}</div>
        <div><span class="containment-status-pill containment-status-pill--${r.status}">${statusLabel[r.status]}</span></div>
        ${r.status === 'investigation' ? `
        <div class="containment-card__actions">
          <button class="btn btn--danger btn--xs" data-action="resolve-containment" data-scp="${escHtml(r.num)}" data-status="breached">Breached</button>
          <button class="btn btn--success btn--xs" data-action="resolve-containment" data-scp="${escHtml(r.num)}" data-status="secure">Fine</button>
        </div>` : ''}
      </div>`).join('');
    },

    async resolve(scp, status) {
        if (!Session.can('MANAGE:CONTAINMENT')) { denyOpsAction('MANAGE:CONTAINMENT'); return; }
        try {
            await Api.setContainmentStatus(scp, status);
            Toast.show(`SCP-${scp} marked ${status === 'breached' ? 'Breached' : 'Fine'}`, status === 'breached' ? 'error' : 'success');
            this.render();
        } catch { /* toast already shown */ }
    }
};

/* ═══════════════════════════════════════════════════════════════════════════
   ADMIN USER DASHBOARD
   ═══════════════════════════════════════════════════════════════════════ */
const STATUS_TONE = { PENDING: 'yellow', ACTIVE: 'green', SUSPENDED: 'orange', LOCKED: 'red' };

const Admin = {
    _users: [],
    _tab: 'users',
    _permCatalog: [],
    _permTargetRole: null,
    _permTargetUser: null,

    async render() {
        this._tab = 'users';
        await this._renderUsers();
    },

    _switchTab(tab) {
        this._tab = tab;
        document.querySelectorAll('.admin-tab').forEach(el => el.classList.toggle('is-active', el.dataset.tab === tab));
        document.getElementById('adminUsersPane').classList.toggle('hidden', tab !== 'users');
        document.getElementById('adminPermissionsPane').classList.toggle('hidden', tab !== 'permissions');
        if (tab === 'permissions') this._renderPermissions();
    },

    async _renderUsers() {
        try { this._users = await Api.adminListUsers(); }
        catch { this._users = []; }
        document.getElementById('adminResultCount').textContent = `${this._users.length} users`;

        const roleOptions = Roles.list.map(({ code }) => `<option value="${code}">${code}</option>`).join('');
        const statusOptions = ['PENDING', 'ACTIVE', 'SUSPENDED', 'LOCKED'].map(s => `<option value="${s}">${s}</option>`).join('');

        const table = document.getElementById('adminUserTable');
        if (!this._users.length) {
            table.innerHTML = `<div class="empty-state"><svg class="icon"><use href="#icon-inbox"/></svg><div class="empty-state__title">No users</div></div>`;
            return;
        }
        table.innerHTML = `
      <div class="admin-table-head"><span>User</span><span>Role</span><span>Clearance</span><span>Status</span><span></span></div>
      ${this._users.map(u => {
          const isSelf = u.id === Session.userId;
          return `
        <div class="admin-row admin-row--${(u.status || 'pending').toLowerCase()}">
          <div class="admin-row__user">
            <span class="admin-row__username">${escHtml(u.username)}${isSelf ? ' <span style="color:var(--text-dim);font-weight:400">(you)</span>' : ''}</span>
            <span class="admin-row__name">${escHtml(u.displayName || '')}${u.mustChangePassword ? ' · <span style="color:var(--caution)">pending pw change</span>' : ''}</span>
          </div>
          <select class="admin-row__role-select" data-admin-field="role" data-id="${escHtml(u.id)}" ${isSelf ? 'disabled' : ''}>
            <option value="">— none —</option>
            ${roleOptions}
          </select>
          <select class="admin-row__clearance-select" data-admin-field="clearance" data-id="${escHtml(u.id)}" ${isSelf ? 'disabled' : ''}>
            ${[0, 1, 2, 3, 4, 5, 6].map(n => `<option value="${n}">${n}</option>`).join('')}
          </select>
          <select class="admin-row__clearance-select" data-admin-field="status" data-id="${escHtml(u.id)}" ${isSelf ? 'disabled' : ''}>
            ${statusOptions}
          </select>
          <div class="admin-row__actions">
            <button class="btn btn--ghost btn--xs" data-action="admin-edit-permissions" data-id="${escHtml(u.id)}" title="Edit permission overrides" ${isSelf ? 'disabled' : ''}><svg class="icon icon--sm"><use href="#icon-lock"/></svg></button>
            <button class="btn btn--ghost btn--xs" data-action="admin-reset-password" data-id="${escHtml(u.id)}" title="Reset password" ${isSelf ? 'disabled' : ''}><svg class="icon icon--sm"><use href="#icon-save"/></svg></button>
            <button class="btn btn--danger btn--xs" data-action="admin-delete-user" data-id="${escHtml(u.id)}" title="Delete account" ${isSelf ? 'disabled' : ''}><svg class="icon icon--sm"><use href="#icon-trash"/></svg></button>
          </div>
        </div>`;
      }).join('')}
    `;

        this._users.forEach(u => {
            const roleSel = table.querySelector(`select[data-admin-field="role"][data-id="${CSS.escape(u.id)}"]`);
            const clSel = table.querySelector(`select[data-admin-field="clearance"][data-id="${CSS.escape(u.id)}"]`);
            const stSel = table.querySelector(`select[data-admin-field="status"][data-id="${CSS.escape(u.id)}"]`);
            if (roleSel) roleSel.value = u.roleCode || '';
            if (clSel) clSel.value = String(u.clearance ?? 0);
            if (stSel) stSel.value = u.status || 'PENDING';
        });

        table.querySelectorAll('[data-admin-field="role"]').forEach(el => el.addEventListener('change', e => this.updateUser(e.target.dataset.id, { roleCode: e.target.value || null })));
        table.querySelectorAll('[data-admin-field="clearance"]').forEach(el => el.addEventListener('change', e => this.updateUser(e.target.dataset.id, { clearance: parseInt(e.target.value) })));
        table.querySelectorAll('[data-admin-field="status"]').forEach(el => el.addEventListener('change', e => this.updateUser(e.target.dataset.id, { status: e.target.value })));
    },

    async updateUser(id, patch) {
        try {
            await Api.adminUpdateUser(id, patch);
            Toast.show('User updated', 'success');
            this._renderUsers();
        } catch { /* toast already shown; re-render so a rejected self-edit (400) visually reverts */ this._renderUsers(); }
    },

    async resetPassword(id) {
        try {
            const { tempPassword } = await Api.adminResetPassword(id);
            document.getElementById('tempPasswordDisplay').textContent = tempPassword;
            Modal.open('temp-password');
            this._renderUsers();
        } catch { /* toast already shown */ }
    },

    async deleteUser(id) {
        const ok = await ConfirmDialog.ask('Delete this user account?', 'This cannot be undone and will end any active session immediately.');
        if (!ok) return;
        try {
            await Api.adminDeleteUser(id);
            Toast.show('User deleted', 'success');
            this._renderUsers();
        } catch { /* toast already shown */ }
    },

    /* ── Permission Management sub-view ─────────────────────────────── */

    async _renderPermissions() {
        try { this._permCatalog = (await Api.adminGetPermissionCatalog()).actions; }
        catch { this._permCatalog = []; }
        if (!this._permTargetRole) this._permTargetRole = Roles.list[0]?.code || null;

        document.getElementById('permRoleSelect').innerHTML = Roles.list.map(r => `<option value="${r.code}">${r.code} — ${escHtml(r.name)}</option>`).join('');
        document.getElementById('permRoleSelect').value = this._permTargetRole;
        await this._renderRolePermissionGrid();
    },

    async selectRole(role) {
        this._permTargetRole = role;
        await this._renderRolePermissionGrid();
    },

    async _renderRolePermissionGrid() {
        if (!this._permTargetRole) return;
        let data;
        try { data = await Api.adminGetRolePermissions(this._permTargetRole); }
        catch { return; }

        document.getElementById('permRoleCustomizedTag').classList.toggle('hidden', !data.isCustomized);
        const grid = document.getElementById('permRoleGrid');
        grid.innerHTML = this._permCatalog.map(action => `
      <label class="check-item" style="padding:8px 10px">
        <input type="checkbox" data-perm-action="${escHtml(action)}" ${matchesPermission(data.permissions, action) ? 'checked' : ''}>
        <div class="check-box"></div>
        <span class="check-item__label" style="font-family:var(--f-mono);font-size:11px">${escHtml(action)}</span>
      </label>`).join('');
    },

    async saveRolePermissions() {
        const checked = [...document.querySelectorAll('#permRoleGrid [data-perm-action]:checked')].map(el => el.dataset.permAction);
        try {
            await Api.adminSetRolePermissions(this._permTargetRole, checked);
            Toast.show(`Permissions updated for ${this._permTargetRole}`, 'success');
            this._renderRolePermissionGrid();
        } catch { /* toast already shown (includes the ADMIN-role lockout guard message) */ }
    },

    async resetRolePermissions() {
        const ok = await ConfirmDialog.ask(`Reset ${this._permTargetRole} to JSON-config defaults?`, 'Any customizations for this role will be discarded.');
        if (!ok) return;
        try {
            await Api.adminResetRolePermissions(this._permTargetRole);
            Toast.show(`${this._permTargetRole} reset to defaults`, 'success');
            this._renderRolePermissionGrid();
        } catch { /* toast already shown */ }
    },

    async openUserPermissionEditor(userId) {
        this._permTargetUser = userId;
        const user = this._users.find(u => u.id === userId);
        if (!this._permCatalog.length) {
            try { this._permCatalog = (await Api.adminGetPermissionCatalog()).actions; } catch { /* modal will just show nothing */ }
        }
        let data;
        try { data = await Api.adminGetUserPermissions(userId); }
        catch { Toast.show('Failed to load permissions', 'error'); return; }

        document.getElementById('userPermTitle').textContent = `Permissions — ${user?.username || 'user'}`;
        document.getElementById('userPermCustomizedTag').classList.toggle('hidden', !data.isCustomized);
        document.getElementById('userPermGrid').innerHTML = this._permCatalog.map(action => `
      <label class="check-item" style="padding:8px 10px">
        <input type="checkbox" data-perm-action="${escHtml(action)}" ${matchesPermission(data.permissions, action) ? 'checked' : ''}>
        <div class="check-box"></div>
        <span class="check-item__label" style="font-family:var(--f-mono);font-size:11px">${escHtml(action)}</span>
      </label>`).join('');
        Modal.open('user-permissions');
    },

    async saveUserPermissions() {
        const checked = [...document.querySelectorAll('#userPermGrid [data-perm-action]:checked')].map(el => el.dataset.permAction);
        try {
            await Api.adminSetUserPermissions(this._permTargetUser, checked);
            Toast.show('User permission override saved', 'success');
            Modal.close('user-permissions');
        } catch { /* toast already shown */ }
    },

    async resetUserPermissions() {
        try {
            await Api.adminResetUserPermissions(this._permTargetUser);
            Toast.show('User override cleared — now inherits role permissions', 'success');
            this.openUserPermissionEditor(this._permTargetUser);
        } catch { /* toast already shown */ }
    }
};


/* ═══════════════════════════════════════════════════════════════════════════
   FACILITY SESSIONS  ("Log Sessions" — server-hop reset grouping)
   ═══════════════════════════════════════════════════════════════════════ */
const FacilitySession = {
    _collapsedKey: 'ssrp_collapsed_sessions',
    list: [],

    async load() {
        try { this.list = await Api.listLogSessions(); }
        catch { this.list = []; }
        return this.list;
    },

    getCollapsed() {
        try { return new Set(JSON.parse(localStorage.getItem(this._collapsedKey) || '[]')); }
        catch { return new Set(); }
    },

    toggleCollapsed(id) {
        const set = this.getCollapsed();
        set.has(id) ? set.delete(id) : set.add(id);
        try { localStorage.setItem(this._collapsedKey, JSON.stringify([...set])); } catch { /* ignore */ }
    },

    async startNew() {
        const ok = await ConfirmDialog.ask(
            'Start a new facility session?',
            'Alarm, Threat, and CDC status will reset to defaults. Existing logs are kept, just grouped under the previous session.'
        );
        if (!ok) return;
        try {
            await Api.createLogSession();
            Toast.show('New facility session started', 'success');
            Drawer.close();
            await Views.showDashboard();
        } catch { /* toast already shown */ }
    }
};

const Detail = {
    render(log) {
        const scp = S.scps[log.scp] || {};
        const date = log.createdAt?.split('T')[0] || '—';
        const surv = log.survivalRate ?? 100;
        const survColor = surv >= 75 ? 'var(--clear)' : surv >= 40 ? 'var(--caution)' : 'var(--signal)';
        const status = (log.finalStatus || 'unknown').toLowerCase();
        const cls = scp.class || '';

        const allEvents = [
            ...(log.timeline || []).map(e => e.type ? e : { ...e, type: 'event' }),
            ...(log.manualLogs || []).map(e => ({ event: e.text, timestamp: e.timestamp, type: 'manual' }))
        ].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        const feedHtml = allEvents.map(e => {
            const ts = new Date(e.timestamp).toISOString().replace('T', ' ').slice(0, 19);
            return `<div class="feed-entry feed-entry--${e.type}"><span class="feed-entry__ts">[${ts}]</span><span class="feed-entry__text">${escHtml(timelineLabel(e.event))}</span></div>`;
        }).join('') || `<div class="feed-empty">${I18n.t('detail.no_events')}</div>`;

        const alertCard = (label, startVal, endVal) => `
      <div class="alert-report-card">
        <div class="alert-report-card__label">${label}</div>
        <div class="alert-report-card__val">
          <span class="chip chip--${ALERT_TONE[startVal] || 'none'}">START: ${escHtml(startVal)}</span>
          <span style="color:var(--text-dim)">→</span>
          <span class="chip chip--${ALERT_TONE[endVal] || 'none'}">END: ${escHtml(endVal)}</span>
        </div>
      </div>`;

        document.getElementById('detailContent').innerHTML = `
      ${scp.class ? `
      <div class="report__header">
        <div class="identity identity--${cls}">
          <div class="identity__num"><span class="chevron">›</span>SCP-${escHtml(log.scp)}</div>
          <div>
            <div class="identity__name">${escHtml(scp.name || '')}</div>
            <div class="identity__class ${cls}">${escHtml(cls.toUpperCase())}</div>
            <div class="identity__meta">
              ${scp.sector ? `<span><span class="dot"></span>${I18n.t('detail.sector')} — ${escHtml(scp.sector)}</span>` : ''}
              <span><span class="dot"></span>${I18n.t('detail.clearance')} ${log.requiredClearance}</span>
              <span><span class="dot"></span>${escHtml((log.location || '').toUpperCase())}</span>
            </div>
          </div>
        </div>
        <div class="report__header-side">
          ${log._elevatedAccess ? `<span class="elevated-badge" title="Visible via role-override, not base clearance"><svg class="icon icon--sm"><use href="#icon-lock"/></svg>ELEVATED ACCESS</span>` : ''}
          <span class="status-tag status-tag--${status}">${I18n.t('statuses.' + status)}${log.finalSubStatus ? ` — ${I18n.t('substatus.' + log.finalSubStatus)}` : ''}</span>
          <span style="font-size:11px;color:var(--text-dim)">${date}</span>
        </div>
      </div>` : ''}

      <div class="report__grid">
        <div>
          <div class="report-block">
            <div class="report-block__head">${I18n.t('panel.subject')}</div>
            <div class="report-block__body">
              <dl class="kv-grid">
                <dt>${I18n.t('field.researcher_name')}</dt><dd>${escHtml(log.researcherName || '—')} · ${escHtml(log.researcherRank || '')}</dd>
                <dt>${I18n.t('field.ethics')}</dt><dd>${log.ethicsObserver ? '✓ Yes' : '— No'}</dd>
                <dt>${I18n.t('field.equipment')}</dt><dd>${escHtml(equipmentSummary(log.equipment))}</dd>
              </dl>
            </div>
          </div>

          <div class="report-block">
            <div class="report-block__head">${I18n.t('panel.personnel')}</div>
            <div class="report-block__body">
              <div class="badge-row">
                <span class="pbadge pbadge--cd">CD ${log.personnel?.cd || 0}</span>
                <span class="pbadge pbadge--sd">SD ${log.personnel?.sd || 0}</span>
                <span class="pbadge pbadge--mtf">MTF ${log.personnel?.mtf || 0}</span>
                <span class="pbadge pbadge--rrt">RRT ${log.personnel?.rrt || 0}</span>
              </div>
            </div>
          </div>

          <div class="report-block">
            <div class="report-block__head">${I18n.t('detail.alert_state')}</div>
            <div class="report-block__body">
              <div class="alert-report-grid">
                ${alertCard(I18n.t('field.alarm_level'), log.startAlarmLevel, log.endAlarmLevel)}
                ${alertCard(I18n.t('field.threat_level'), log.startThreatLevel, log.endThreatLevel)}
                ${alertCard(I18n.t('field.cdc_alert'), log.startCDCAlert, log.endCDCAlert)}
              </div>
            </div>
          </div>

          <div class="report-block">
            <div class="report-block__head">${I18n.t('panel.casualties')}</div>
            <div class="report-block__body">
              <dl class="kv-grid">
                <dt>${I18n.t('casualties.terminated')}</dt><dd style="color:var(--sd)">${log.casualties?.terminatedBySecurity || 0}</dd>
                <dt>${I18n.t('casualties.killed_scp')}</dt><dd style="color:var(--signal)">${log.casualties?.killedBySCP || 0}</dd>
                <dt>${I18n.t('casualties.personnel_lost_short')}</dt><dd style="color:var(--mtf)">${log.casualties?.personnelLost || 0}</dd>
              </dl>
              <div class="survival-meter">
                <div class="survival-meter__row"><span class="field__label">${I18n.t('casualties.survival_rate')}</span><span style="font-family:var(--f-display);font-size:20px;color:${survColor}">${surv}%</span></div>
                <div class="survival-meter__track"><div class="survival-meter__fill" style="width:${surv}%;background:${survColor}"></div></div>
              </div>
            </div>
          </div>

          ${(() => {
            const audit = (log.manualLogs || []).map(parseAuditEntry).filter(Boolean)
                .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            if (!audit.length) return '';
            const catMeta = {
                security: { label: 'Terminated by Security', icon: 'icon-alert-triangle', color: 'var(--sd)' },
                scp: { label: 'Killed by SCP', icon: 'icon-alert-triangle', color: 'var(--signal)' },
                personnel: { label: 'Personnel Lost', icon: 'icon-alert-triangle', color: 'var(--mtf)' }
            };
            return `<div class="report-block">
              <div class="report-block__head" style="color:var(--signal)">${I18n.t('detail.audit_trail')} <span style="color:var(--text-dim);font-weight:400;text-transform:none;letter-spacing:0">(${audit.length})</span></div>
              <div class="report-block__body" style="padding:var(--sp-3) var(--sp-5)">
                <div class="audit-list">
                  ${audit.map(a => {
                      const meta = catMeta[a.category];
                      const ts = new Date(a.timestamp).toISOString().replace('T', ' ').slice(0, 19);
                      return `<div class="audit-entry">
                        <svg class="icon icon--sm" style="color:${meta.color}"><use href="#${meta.icon}"/></svg>
                        <div class="audit-entry__body">
                          <div class="audit-entry__head"><strong style="color:${meta.color}">${escHtml(meta.label)}</strong><span class="audit-entry__unit">Unit #${a.unitNum}</span><span class="audit-entry__ts">${ts} UTC</span></div>
                          <div class="audit-entry__reason">${a.reason ? escHtml(a.reason) : `<em style="color:var(--text-dim)">${I18n.t('detail.no_reason')}</em>`}</div>
                        </div>
                      </div>`;
                  }).join('')}
                </div>
              </div>
            </div>`;
          })()}

          ${(log.crossScps && log.crossScps.length) ? `<div class="report-block">
            <div class="report-block__head">Cross-Test Correlation</div>
            <div class="report-block__body">
              <div class="badge-row" style="margin-bottom:var(--sp-3)">
                <span class="pbadge">SCP-${escHtml(log.scp)}</span>
                ${log.crossScps.map(s => `<span class="pbadge">SCP-${escHtml(s)}</span>`).join('')}
              </div>
              <div class="cross-warning-list">
                ${(log.crossContamination || []).map(c => `
                  <div class="cross-warning cross-warning--${c.risk}">
                    <span class="cross-warning__tag">${escHtml(c.risk)}</span>
                    <span class="cross-warning__body"><strong>SCP-${escHtml(c.scpA)} × SCP-${escHtml(c.scpB)}</strong> — ${escHtml(c.reason)}</span>
                  </div>`).join('') || '<span style="color:var(--text-dim);font-size:12px">No contamination pairs recorded.</span>'}
              </div>
            </div>
          </div>` : ''}

          ${log.notes ? `<div class="report-block">
            <div class="report-block__head">${I18n.t('status.notes')}</div>
            <div class="report-block__body" style="white-space:pre-wrap">${escHtml(log.notes)}</div>
          </div>` : ''}
        </div>

        <div>
          <div class="report-block">
            <div class="report-block__head">${I18n.t('panel.timeline')}</div>
            <div class="report-block__body"><div class="feed feed--tall">${feedHtml}</div></div>
          </div>
        </div>
      </div>

      <div class="sig-block" style="margin-top:var(--sp-4)">
        <div class="sig-block__line">Signed: <span class="sig-block__name">Researcher ${escHtml(log.researcherName || 'N/A')}</span> &nbsp;|&nbsp; ${escHtml(log.researcherRank || 'N/A')} &nbsp;|&nbsp; <span style="color:var(--text-dim)">${date}</span></div>
        <div style="font-size:10px;color:var(--text-dim);margin-top:4px">Log ID: ${escHtml(log.id)}</div>
      </div>`;

        document.getElementById('detailExportBtn').classList.toggle('hidden', !Session.can('EXPORT:TEST'));
        document.getElementById('detailEditBtn').classList.toggle('hidden', !Session.can('EDIT:TEST'));
        document.getElementById('detailDeleteBtn').classList.toggle('hidden', !Session.can('DELETE:TEST'));
    }
};

/* ═══════════════════════════════════════════════════════════════════════════
   OPS CONSOLE  (breach / nuke / alarms / threat / cdc / broadcast)
   ═══════════════════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════════════════════
   REPORT GENERATOR  (auto-generated after-action PDF)
   ═══════════════════════════════════════════════════════════════════════ */
const ReportGenerator = {
    _doc() {
        if (!window.jspdf) { Toast.show('PDF library failed to load.', 'error'); return null; }
        return new window.jspdf.jsPDF({ unit: 'pt', format: 'a4' });
    },

    _header(doc, title, subtitle) {
        doc.setFillColor(10, 11, 13);
        doc.rect(0, 0, 595, 90, 'F');
        doc.setTextColor(255, 59, 92);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.text('☣ SITE SECURITY REPORTING PLATFORM', 40, 38);
        doc.setTextColor(230, 230, 235);
        doc.setFontSize(13);
        doc.text(title, 40, 60);
        doc.setTextColor(160, 160, 168);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(subtitle, 40, 76);
        doc.setTextColor(20, 20, 20);
        return 112;
    },

    _section(doc, y, label) {
        doc.setFillColor(235, 235, 238);
        doc.rect(40, y, 515, 18, 'F');
        doc.setTextColor(180, 30, 50);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.text(label.toUpperCase(), 46, y + 13);
        doc.setTextColor(30, 30, 30);
        doc.setFont('helvetica', 'normal');
        return y + 30;
    },

    _line(doc, y, text, opts = {}) {
        doc.setFontSize(opts.size || 10);
        if (opts.bold) doc.setFont('helvetica', 'bold'); else doc.setFont('helvetica', 'normal');
        const wrapped = doc.splitTextToSize(text, opts.width || 515);
        doc.text(wrapped, 40, y);
        return y + (wrapped.length * (opts.lineHeight || 13));
    },

    _footer(doc) {
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`Generated ${new Date().toISOString()} — CLASSIFIED — FOUNDATION USE ONLY`, 40, 812);
    },

    generateLogReport(log) {
        const doc = this._doc();
        if (!doc) return;
        const scp = S.scps[log.scp] || {};
        let y = this._header(doc, `Test Log — SCP-${log.scp}`, `${scp.name || ''} · ${(scp.class || '').toUpperCase()} · Logged ${formatUtcFull(log.createdAt)}`);

        y = this._section(doc, y, 'Test Metadata');
        y = this._line(doc, y, `Researcher: ${log.researcherName} (${log.researcherRank || 'N/A'})`);
        y = this._line(doc, y, `Clearance Required: Level ${log.requiredClearance}   Location: ${(log.location || '').toUpperCase()}`);
        y = this._line(doc, y, `Final Status: ${log.finalStatus}${log.finalSubStatus ? ' — ' + log.finalSubStatus : ''}   Survival Rate: ${log.survivalRate}%`);
        y += 8;

        y = this._section(doc, y, 'Personnel & Casualties');
        y = this._line(doc, y, `Deployed — CD:${log.personnel?.cd || 0}  SD:${log.personnel?.sd || 0}  MTF:${log.personnel?.mtf || 0}  RRT:${log.personnel?.rrt || 0}`);
        y = this._line(doc, y, `Terminated by Security: ${log.casualties?.terminatedBySecurity || 0}   Killed by SCP: ${log.casualties?.killedBySCP || 0}   Personnel Lost: ${log.casualties?.personnelLost || 0}`);
        y += 8;

        const audit = (log.manualLogs || []).map(parseAuditEntry).filter(Boolean);
        if (audit.length) {
            y = this._section(doc, y, 'Casualty Audit Trail');
            audit.forEach(a => {
                y = this._line(doc, y, `[${new Date(a.timestamp).toISOString().slice(11, 19)}] ${a.category.toUpperCase()} — Unit #${a.unitNum} — ${a.reason || 'No reason provided'}`, { size: 9 });
                if (y > 760) { doc.addPage(); y = 50; }
            });
            y += 8;
        }

        if (log.crossScps && log.crossScps.length) {
            y = this._section(doc, y, 'Cross-Test Correlation');
            y = this._line(doc, y, `Subjects: SCP-${log.scp}, ${log.crossScps.map(s => 'SCP-' + s).join(', ')}`);
            (log.crossContamination || []).forEach(c => {
                y = this._line(doc, y, `SCP-${c.scpA} × SCP-${c.scpB} [${c.risk.toUpperCase()}]: ${c.reason}`, { size: 9 });
                if (y > 760) { doc.addPage(); y = 50; }
            });
            y += 8;
        }

        y = this._section(doc, y, 'Timeline');
        const events = [
            ...(log.timeline || []).map(e => e.type ? e : { ...e, type: 'event' }),
            ...(log.manualLogs || []).map(e => ({ event: e.text, timestamp: e.timestamp }))
        ].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        events.forEach(e => {
            if (y > 760) { doc.addPage(); y = 50; }
            y = this._line(doc, y, `[${new Date(e.timestamp).toISOString().slice(11, 19)}] ${e.event}`, { size: 9 });
        });

        if (log.notes) {
            if (y > 700) { doc.addPage(); y = 50; }
            y = this._section(doc, y, 'Notes');
            y = this._line(doc, y, log.notes, { size: 9.5 });
        }

        this._footer(doc);
        doc.save(`SCP-${log.scp}-${log.id.slice(0, 8)}-report.pdf`);
    },

    generateBreachReport(breachEvent) {
        const doc = this._doc();
        if (!doc) return;
        const scp = S.scps[breachEvent.scp] || {};
        let y = this._header(doc, `Incident After-Action Report`, `${breachEvent.type} — SCP-${breachEvent.scp || 'N/A'} — ${formatUtcFull(breachEvent.createdAt)}`);

        y = this._section(doc, y, 'Incident Summary');
        y = this._line(doc, y, `Type: ${breachEvent.type}   Subject: SCP-${breachEvent.scp || 'N/A'} ${scp.name || ''}`);
        y = this._line(doc, y, `Reported by: ${breachEvent.researcherName || 'Unknown'} (${breachEvent.researcherRank || ''})`);
        y = this._line(doc, y, `Status: ${breachEvent.status || ''}`);
        y += 8;

        const linkedEnd = S.events.find(e => e.type === 'BREACH_END' && e.linkedEventId === breachEvent.id);
        y = this._section(doc, y, 'Resolution');
        y = this._line(doc, y, linkedEnd ? `Terminated at ${formatUtcFull(linkedEnd.createdAt)}` : 'UNRESOLVED — breach remains active at time of report generation.');
        y += 8;

        const linkedLogs = S.logs.filter(l => l.scp === breachEvent.scp);
        if (linkedLogs.length) {
            y = this._section(doc, y, 'Linked Test Logs for this Subject');
            linkedLogs.slice(0, 10).forEach(l => {
                if (y > 760) { doc.addPage(); y = 50; }
                y = this._line(doc, y, `${formatUtcFull(l.createdAt)} — ${l.finalStatus}${l.finalSubStatus ? ' (' + l.finalSubStatus + ')' : ''} — Survival ${l.survivalRate}%`, { size: 9 });
            });
        }

        this._footer(doc);
        doc.save(`incident-${breachEvent.type}-${breachEvent.id.slice(0, 8)}-report.pdf`);
    }
};

const OpsConsole = {
    breachSelectedScp: null,

    getActiveBreaches() {
        const breaches = S.events.filter(e => e.type === 'BREACH' || e.type === 'CDC_RIOT');
        const endedIds = S.events.filter(e => e.type === 'BREACH_END').map(e => e.linkedEventId);
        return breaches.filter(b => !endedIds.includes(b.id));
    },

    refreshBreachIndicator() {
        document.getElementById('endBreachItem').classList.toggle('hidden', this.getActiveBreaches().length === 0);
    },

    /** Disables and lock-icons every drawer item the current role isn't
     *  permitted to use. The server re-checks authoritatively regardless
     *  (auth.middleware.js) — this is purely so the UI doesn't dangle an
     *  action in front of someone who'll just get a 403 for trying. */
    applyPermissionGating() {
        document.querySelectorAll('[data-ops-action]').forEach(btn => {
            const action = btn.dataset.opsAction;
            const allowed = Session.can(action);
            btn.disabled = !allowed;
            btn.classList.toggle('is-locked', !allowed);
            btn.querySelector('.drawer__lock')?.classList.toggle('hidden', allowed);
            btn.title = allowed ? '' : `Missing permission: ${action}`;
        });
    },

    openBreachModal() {
        this.breachSelectedScp = null;
        document.getElementById('breachScpSearch').value = '';
        document.getElementById('breachSelectedInfo').innerHTML = '';
        document.getElementById('breachAutocomplete').classList.add('hidden');
        Modal.open('breach');
    },

    async submitBreach() {
        if (!this.breachSelectedScp) { Toast.show(I18n.t('toasts.select_scp'), 'error'); return; }
        try {
            await Api.createEvent({
                type: 'BREACH', scp: this.breachSelectedScp,
                researcherName: 'SITE-SECURITY', researcherRank: 'AUTOMATED-ALERT',
                status: 'Containment Breach', createdAt: new Date().toISOString()
            });
            Toast.show(I18n.t('toasts.breach_logged'), 'success');
            Modal.close('breach');
            await loadAll(); Dashboard.render();
        } catch { /* toast already shown */ }
    },

    async submitCdcRiot() {
        try {
            await Api.createEvent({
                type: 'CDC_RIOT', researcherName: 'SITE-SECURITY', researcherRank: 'AUTOMATED-ALERT',
                status: 'CDC Riot / Civil Unrest', createdAt: new Date().toISOString()
            });
            Toast.show(I18n.t('toasts.cdc_riot_logged'), 'success');
            await loadAll(); Dashboard.render();
        } catch { /* toast already shown */ }
    },

    openBreachEndModal() {
        const active = this.getActiveBreaches();
        const list = document.getElementById('activeBreachList');
        list.innerHTML = active.length ? active.map(b => {
            const scp = S.scps[b.scp] || {};
            const label = b.type === 'CDC_RIOT' ? I18n.t('drawer.cdc_riot') : `SCP-${escHtml(b.scp)} ${escHtml(scp.name || '')}`;
            return `<div class="active-breach-item"><span>${label}</span><button class="btn btn--success btn--xs" data-action="end-breach" data-id="${escHtml(b.id)}" data-scp="${escHtml(b.scp || '')}">${I18n.t('drawer.breach_end')}</button></div>`;
        }).join('') : `<p style="color:var(--text-dim);font-size:12.5px">${I18n.t('detail.no_active_breaches')}</p>`;
        Modal.open('breach-end');
    },

    async submitBreachEnd(breachId, scpNum) {
        try {
            await Api.createEvent({
                type: 'BREACH_END', scp: scpNum, linkedEventId: breachId,
                researcherName: 'SITE-SECURITY', researcherRank: 'AUTOMATED-ALERT',
                status: 'Breach Terminated', createdAt: new Date().toISOString()
            });
            Toast.show(I18n.t('toasts.breach_ended'), 'success');
            Modal.close('breach-end');
            await loadAll(); Dashboard.render();
        } catch { /* toast already shown */ }
    },

    async submitBroadcast() {
        const content = document.getElementById('fBroadcastContent').value.trim();
        if (!content) { Toast.show(I18n.t('toasts.broadcast_placeholder'), 'error'); return; }
        try {
            await Api.createEvent({
                type: 'BROADCAST', scp: 'AUDIO', researcherName: 'SITE-COMMS', researcherRank: 'BROADCAST',
                status: content, createdAt: new Date().toISOString()
            });
            Toast.show(I18n.t('toasts.broadcast_logged'), 'info');
            document.getElementById('fBroadcastContent').value = '';
            Modal.close('broadcast');
            await loadAll(); Dashboard.render();
        } catch { /* toast already shown */ }
    },

    async submitNuke(key) {
        const labelKey = `nuke.${key}`;
        try {
            await Api.createEvent({
                type: 'WARHEAD', scp: 'NUKE', researcherName: 'SITE-COMMAND', researcherRank: 'ALPHA-WARHEAD',
                status: I18n.t(labelKey), createdAt: new Date().toISOString()
            });
            Toast.show(I18n.t('toasts.nuke_logged'), 'warning');
            Modal.close('nuke');
            await loadAll(); Dashboard.render();
        } catch { /* toast already shown */ }
    },

    renderOptionGrid(gridId, opts, actionName) {
        const main = opts.filter(o => o.v !== 'None' && o.v !== 'Unknown');
        const fallback = opts.find(o => o.v === 'None' || o.v === 'Unknown');
        let html = main.map(o => `
      <button type="button" class="option-btn" style="--tone:var(${STATUS_TONE_VAR[ALERT_TONE[o.v]]})" data-action="${actionName}" data-value="${escHtml(o.v)}">
        <span class="option-btn__big">${escHtml(I18n.t(o.l))}</span>
      </button>`).join('');
        if (fallback) {
            html += `<button type="button" class="option-btn option-btn--wide" data-action="${actionName}" data-value="${escHtml(fallback.v)}"><span class="option-btn__small">${escHtml(I18n.t(fallback.l))}</span></button>`;
        }
        document.getElementById(gridId).innerHTML = html;
    },

    async submitAlarm(value) {
        try {
            await Api.createEvent({ type: 'ALARM', scp: 'SITE', researcherName: 'SITE-CONTROL', researcherRank: 'ALARM-CONSOLE', status: `Set Alarm to '${value}'`, createdAt: new Date().toISOString() });
            Toast.show(`${value} alarm logged`, value === 'None' ? 'success' : 'warning');
            S.w.currentAlarmLevel = value; StatusStrip.update('alarm', value);
            Modal.close('alarm'); await loadAll(); Dashboard.render();
        } catch { /* toast already shown */ }
    },

    async submitThreat(value) {
        try {
            await Api.createEvent({ type: 'THREAT', scp: 'SITE', researcherName: 'SITE-CONTROL', researcherRank: 'THREAT-CONSOLE', status: `Set Threat to '${value}'`, createdAt: new Date().toISOString() });
            Toast.show(`${value} threat logged`, 'warning');
            S.w.currentThreatLevel = value; StatusStrip.update('threat', value);
            Modal.close('threat'); await loadAll(); Dashboard.render();
        } catch { /* toast already shown */ }
    },

    async submitCdc(value) {
        try {
            await Api.createEvent({ type: 'CDC', scp: 'SITE', researcherName: 'SITE-CONTROL', researcherRank: 'CDC-CONSOLE', status: value, createdAt: new Date().toISOString() });
            Toast.show(`${value} CDC status logged`, value === 'Off' ? 'success' : 'warning');
            S.w.currentCDCAlert = value; StatusStrip.update('cdc', value);
            Modal.close('cdc'); await loadAll(); Dashboard.render();
        } catch { /* toast already shown */ }
    },

    async submitImport() {
        const content = document.getElementById('importTextarea').value.trim();
        if (!content) { Toast.show(I18n.t('toasts.import_pasted'), 'error'); return; }
        try {
            await Api.importLog(content);
            Toast.show(I18n.t('toasts.log_imported'), 'success');
            document.getElementById('importTextarea').value = '';
            Modal.close('import');
            await Views.showDashboard();
        } catch { /* toast already shown */ }
    }
};

/* ═══════════════════════════════════════════════════════════════════════════
   SCHEDULING  (Scheduled/recurring tests)
   ═══════════════════════════════════════════════════════════════════════ */
const Scheduling = {
    selectedScp: null,

    openCreateModal() {
        this.selectedScp = null;
        document.getElementById('scheduleScpSearch').value = '';
        document.getElementById('scheduleSelectedInfo').innerHTML = '';
        document.getElementById('scheduleDateTime').value = '';
        document.getElementById('scheduleRecurrence').value = 'once';
        document.getElementById('scheduleCd').value = '1';
        document.getElementById('scheduleSd').value = '2';
        document.getElementById('scheduleMtf').value = '2';
        document.getElementById('scheduleRrt').value = '0';
        document.getElementById('scheduleNotes').value = '';
        Modal.open('schedule');
    },

    pickScp(num) {
        const data = S.scps[num];
        if (!data) return;
        this.selectedScp = num;
        document.getElementById('scheduleScpSearch').value = `SCP-${num} — ${data.name || ''}`;
        document.getElementById('scheduleAutocomplete').classList.add('hidden');
        document.getElementById('scheduleSelectedInfo').innerHTML = `<span class="class-tag class-tag--${(data.class || '').toLowerCase()}">${(data.class || '').toUpperCase()}</span> <strong>${escHtml(data.name || '')}</strong>`;
    },

    async submitCreate() {
        if (!this.selectedScp) { Toast.show('Select an SCP subject first.', 'error'); return; }
        const when = document.getElementById('scheduleDateTime').value;
        if (!when) { Toast.show('Set a test window.', 'error'); return; }
        const payload = {
            scp: this.selectedScp,
            scheduledFor: new Date(when).toISOString(),
            recurrence: document.getElementById('scheduleRecurrence').value,
            personnel: {
                cd: parseInt(document.getElementById('scheduleCd').value) || 0,
                sd: parseInt(document.getElementById('scheduleSd').value) || 0,
                mtf: parseInt(document.getElementById('scheduleMtf').value) || 0,
                rrt: parseInt(document.getElementById('scheduleRrt').value) || 0
            },
            notes: document.getElementById('scheduleNotes').value.trim()
        };
        try {
            await Api.createSchedule(payload);
            Toast.show('Test scheduled', 'success');
            Modal.close('schedule');
        } catch { /* toast already shown */ }
    },

    async openListModal() {
        const body = document.getElementById('scheduleListBody');
        body.innerHTML = '<div class="feed-empty">Loading…</div>';
        Modal.open('schedule-list');
        let schedules = [];
        try { schedules = await Api.listSchedules(); } catch { body.innerHTML = '<div class="feed-empty">Failed to load.</div>'; return; }
        if (!schedules.length) { body.innerHTML = '<div class="feed-empty">No scheduled tests.</div>'; return; }
        body.innerHTML = schedules.map(s => {
            const scp = S.scps[s.scp] || {};
            const when = new Date(s.scheduledFor).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
            return `<div class="active-breach-item">
        <span><strong>SCP-${escHtml(s.scp)}</strong> ${escHtml(scp.name || '')} — ${when} <span class="chip chip--none">${escHtml(s.recurrence)}</span> ${!s.active ? '<span class="chip chip--low">fired</span>' : ''}</span>
        <button class="btn btn--danger btn--xs" data-action="delete-schedule" data-id="${escHtml(s.id)}"><svg class="icon icon--sm"><use href="#icon-trash"/></svg></button>
      </div>`;
        }).join('');
    },

    async remove(id) {
        try {
            await Api.deleteSchedule(id);
            Toast.show('Schedule removed', 'success');
            this.openListModal();
        } catch { /* toast already shown */ }
    }
};

/* ═══════════════════════════════════════════════════════════════════════════
   REALTIME FEED  (advanced feature #2 — Server-Sent-Events live streaming)
   ═══════════════════════════════════════════════════════════════════════ */
const RealtimeFeed = {
    _source: null,

    connect() {
        if (!window.EventSource) { console.warn('SSE: EventSource unsupported in this browser'); return; }
        if (this._source) this._source.close();

        if (!Session.isActive()) return;
        const source = new EventSource(`${API_BASE}/api/stream?token=${encodeURIComponent(Session.token)}`);
        this._source = source;

        source.addEventListener('hello', () => this._setStatus('connected'));
        source.addEventListener('log:upsert', e => this._onLogUpsert(JSON.parse(e.data)));
        source.addEventListener('log:deleted', e => this._onLogDeleted(JSON.parse(e.data)));
        source.addEventListener('event:created', e => this._onEventCreated(JSON.parse(e.data)));
        source.addEventListener('event:deleted', e => this._onEventDeleted(JSON.parse(e.data)));
        source.addEventListener('schedule:due', e => this._onScheduleDue(JSON.parse(e.data)));
        source.addEventListener('logsession:created', e => this._onLogSessionCreated(JSON.parse(e.data)));
        source.addEventListener('containment:override', e => this._onContainmentOverride(JSON.parse(e.data)));
        source.onopen = () => this._setStatus('connected');
        source.onerror = () => this._setStatus('reconnecting'); // native EventSource auto-retries
    },

    disconnect() {
        if (this._source) { this._source.close(); this._source = null; }
        this._setStatus('reconnecting');
    },

    _onScheduleDue({ schedule }) {
        Toast.show(`⏰ Scheduled test due: SCP-${schedule.scp} — draft log created`, 'info');
        if (document.getElementById('view-dashboard')?.classList.contains('is-active')) loadAll().then(() => Dashboard.render());
    },

    _onLogSessionCreated(session) {
        if (session._origin !== CLIENT_ID) Toast.show(`New facility session started: ${session.label}`, 'info');
        if (document.getElementById('view-dashboard')?.classList.contains('is-active')) {
            loadAll().then(() => { StatusStrip.syncAll(); Dashboard.render(); });
        }
    },

    _onContainmentOverride(override) {
        if (document.getElementById('view-board')?.classList.contains('is-active')) ContainmentBoard.render();
    },

    markReconnecting() { this._setStatus('reconnecting'); },

    _setStatus(status) {
        const el = document.getElementById('liveFeedIndicator');
        if (!el) return;
        el.classList.toggle('is-connected', status === 'connected');
        el.classList.toggle('is-reconnecting', status === 'reconnecting');
    },

    _isSelf(payload) { return payload._origin && payload._origin === CLIENT_ID; },

    _onLogUpsert(log) {
        const idx = S.logs.findIndex(l => l.id === log.id);
        const isNew = idx === -1;
        if (isNew) S.logs.unshift(log); else S.logs[idx] = log;
        if (!this._isSelf(log)) {
            Toast.show(isNew ? `New test log received: SCP-${log.scp}` : `Test log updated: SCP-${log.scp}`, 'info');
        }
        if (document.getElementById('view-dashboard').classList.contains('is-active')) Dashboard.render();
        if (S.currentId === log.id && document.getElementById('view-detail').classList.contains('is-active')) Detail.render(log);
    },

    _onLogDeleted({ id, _origin }) {
        S.logs = S.logs.filter(l => l.id !== id);
        if (_origin !== CLIENT_ID && document.getElementById('view-dashboard').classList.contains('is-active')) {
            Toast.show('A test log was removed by another session', 'info');
        }
        if (document.getElementById('view-dashboard').classList.contains('is-active')) Dashboard.render();
    },

    _onEventCreated(ev) {
        if (!S.events.some(e => e.id === ev.id)) S.events.unshift(ev);
        if (!this._isSelf(ev)) Toast.show(`Facility event received: ${ev.type}`, 'info');
        if (document.getElementById('view-dashboard').classList.contains('is-active')) Dashboard.render();
    },

    _onEventDeleted({ id }) {
        S.events = S.events.filter(e => e.id !== id);
        if (document.getElementById('view-dashboard').classList.contains('is-active')) Dashboard.render();
    }
};

/* ═══════════════════════════════════════════════════════════════════════════
   TERMINATION CONFIRM  (enhancement #3 — intercepts submit when the log
   carries any casualties; captures an optional reason and guarantees
   every individual loss becomes its own permanent, timestamped audit
   entry in the log's manualLogs, which ships to the backend markdown file)
   ═══════════════════════════════════════════════════════════════════════ */
const TerminationConfirm = {
    _resolve: null,

    hasCasualties() { return (S.w.termSec + S.w.termScp + S.w.persLost) > 0; },

    ask() {
        const chip = (label, n, tone) => n > 0 ? `<span class="chip chip--${tone}">${label}: ${n}</span>` : '';
        document.getElementById('terminationSummary').innerHTML = [
            chip('Terminated by Security', S.w.termSec, 'breach'),
            chip('Killed by SCP', S.w.termScp, 'breach'),
            chip('Personnel Lost', S.w.persLost, 'medium')
        ].join('');
        document.getElementById('fTerminationReason').value = '';
        Modal.open('termination');
        return new Promise(resolve => { this._resolve = resolve; });
    },

    confirm() {
        const reason = document.getElementById('fTerminationReason').value.trim();
        Modal.close('termination');
        if (this._resolve) { this._resolve(reason); this._resolve = null; }
    },

    cancel() {
        Modal.close('termination');
        if (this._resolve) { this._resolve(null); this._resolve = null; }
    },

    /** Appends one manualLogs entry per individual casualty (not one
     *  summary line per category) so the audit trail strictly captures
     *  every single death, per the requirement. */
    appendAudit(reason) {
        const now = Date.now();
        let offset = 0;
        const pushEach = (count, label) => {
            for (let i = 1; i <= count; i++) {
                offset += 1;
                const timestamp = new Date(now + offset).toISOString();
                const text = `${label} — Unit #${i}${reason ? ` — Reason: ${reason}` : ''}`;
                S.w.manualLogs.push({ text, timestamp });
            }
        };
        pushEach(S.w.termSec, 'CD terminated by Security');
        pushEach(S.w.termScp, 'CD killed by SCP');
        pushEach(S.w.persLost, 'Personnel (SD/MTF/RRT) lost');
        Timeline.renderFeed();
    }
};

/* ═══════════════════════════════════════════════════════════════════════════
   FORM SECTION SCROLLSPY
   ═══════════════════════════════════════════════════════════════════════ */
const FormNav = {
    _observer: null,

    jumpTo(target) {
        document.querySelector(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },

    setActive(target) {
        document.querySelectorAll('.form-nav__item').forEach(item => {
            item.classList.toggle('is-active', item.dataset.target === target);
        });
    },

    observe() {
        if (this._observer) this._observer.disconnect();
        const panels = document.querySelectorAll('#view-form .panel');
        this._observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) this.setActive('#' + entry.target.id);
            });
        }, { rootMargin: '-40% 0px -50% 0px', threshold: 0 });
        panels.forEach(p => this._observer.observe(p));
    }
};

/* ═══════════════════════════════════════════════════════════════════════════
   VIEWS / ROUTER
   ═══════════════════════════════════════════════════════════════════════ */
const LoginView = {
    _mode: 'signin',

    render() {
        document.getElementById('loginError').classList.add('hidden');
        document.getElementById('loginNotice').classList.add('hidden');
        document.getElementById('loginUsername').value = '';
        document.getElementById('loginPassword').value = '';
        document.getElementById('loginRememberMe').checked = false;
        this.showMode('signin');
    },

    showMode(mode) {
        this._mode = mode;
        document.getElementById('loginModeSignin').classList.toggle('hidden', mode !== 'signin');
        document.getElementById('loginModeRegister').classList.toggle('hidden', mode !== 'register');
        document.getElementById('loginCardTitle').textContent = mode === 'signin' ? 'SSRP ACCESS TERMINAL' : 'REQUEST FACILITY ACCESS';
        document.getElementById('loginCardSub').textContent = mode === 'signin'
            ? 'Present credentials to open a site session'
            : 'Submit your details — an administrator must approve your account and assign a role before you can sign in.';
        document.getElementById('loginError').classList.add('hidden');
        document.getElementById('loginNotice').classList.add('hidden');
    },

    async submitLogin() {
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;
        const rememberMe = document.getElementById('loginRememberMe').checked;
        const errEl = document.getElementById('loginError');
        errEl.classList.add('hidden');

        if (!username || !password) { errEl.textContent = 'Enter your username and password.'; errEl.classList.remove('hidden'); return; }

        try {
            const session = await Api.req('POST', '/api/auth/login', { username, password, rememberMe }, { skipQueue: true });
            Session.set(session, rememberMe);
            if (session.mustChangePassword) { Views.showChangePassword(); return; }
            await Views.enterApp();
        } catch (err) {
            errEl.textContent = err.message || 'Login failed.';
            errEl.classList.remove('hidden');
        }
    },

    async submitRegister() {
        const username = document.getElementById('regUsername').value.trim();
        const displayName = document.getElementById('regDisplayName').value.trim();
        const password = document.getElementById('regPassword').value;
        const errEl = document.getElementById('loginError');
        errEl.classList.add('hidden');

        if (username.length < 3) { errEl.textContent = 'Username must be at least 3 characters.'; errEl.classList.remove('hidden'); return; }
        if (password.length < 6) { errEl.textContent = 'Password must be at least 6 characters.'; errEl.classList.remove('hidden'); return; }

        try {
            const res = await Api.register(username, password, displayName);
            this.showMode('signin');
            const notice = document.getElementById('loginNotice');
            notice.textContent = res.message;
            notice.classList.remove('hidden');
            document.getElementById('loginUsername').value = username;
        } catch (err) {
            errEl.textContent = err.message || 'Registration failed.';
            errEl.classList.remove('hidden');
        }
    }
};

const ChangePasswordView = {
    render() {
        document.getElementById('pwOld').value = '';
        document.getElementById('pwNew').value = '';
        document.getElementById('pwChangeError').classList.add('hidden');
    },

    async submit() {
        const oldPassword = document.getElementById('pwOld').value;
        const newPassword = document.getElementById('pwNew').value;
        const errEl = document.getElementById('pwChangeError');
        errEl.classList.add('hidden');
        if (newPassword.length < 6) { errEl.textContent = 'New password must be at least 6 characters.'; errEl.classList.remove('hidden'); return; }
        try {
            await Api.changePassword(oldPassword, newPassword);
            Toast.show('Password changed. Please sign in again.', 'success');
            Session.clear();
            Views.showLogin();
        } catch (err) {
            errEl.textContent = err.message || 'Password change failed.';
            errEl.classList.remove('hidden');
        }
    }
};

const Views = {
    showLogin() {
        RealtimeFeed.disconnect();
        document.getElementById('sessionBadge').classList.add('hidden');
        document.getElementById('topbarAuthActions').classList.add('hidden');
        LoginView.render();
        this._activate('view-login');
    },

    showChangePassword() {
        ChangePasswordView.render();
        this._activate('view-change-password');
    },

    async enterApp() {
        document.getElementById('sessionBadge').classList.remove('hidden');
        document.getElementById('topbarAuthActions').classList.remove('hidden');
        document.getElementById('adminNavBtn').classList.toggle('hidden', !Session.isAdmin());
        document.getElementById('terminal-div').classList.toggle('hidden', !Session.isAdmin());
        document.getElementById('newLogBtn').classList.toggle('hidden', !Session.can('CREATE:TEST'));
        document.getElementById('sessionBadgeRole').textContent = Session.roleCode;
        document.getElementById('sessionBadgeName').textContent = Session.name;
        document.getElementById('sessionMenuName').textContent = Session.name;
        document.getElementById('sessionMenuRole').textContent = `${Session.roleName} — Clearance ${Session.clearance}`;
        await Roles.load();
        await this.showDashboard();
        StatusStrip.syncAll();
        RealtimeFeed.connect();
    },

    async showAdmin() {
        if (!Session.isAdmin()) { Toast.show('Administrator role required.', 'error'); return; }
        await Admin.render();
        this._activate('view-admin');
    },

    async showDashboard() {
        Timer.reset();
        Drawer.close();
        try { await loadAll(); } catch { Toast.show(I18n.t('toasts.server_error'), 'error'); }
        applySettings();
        StatusStrip.syncAll();
        Dashboard.render();
        this._activate('view-dashboard');
    },

    async showBroadcast() {
        document.location.href = "/broadcast";
    },

    showCreate(existingLog = null) {
        S.editMode = !!existingLog;
        S.currentId = existingLog?.id ?? null;
        Timer.reset();

        document.getElementById('formTitle').textContent = existingLog
            ? `${I18n.t('form.edit_title')} · SCP-${existingLog.scp}`
            : I18n.t('form.new_title');

        LogForm.clearFields();
        if (existingLog) LogForm.fill(existingLog);

        AlertPanel.renderStartRows();
        AlertPanel.renderLiveRows();
        Timeline.renderButtons();
        syncSeg('start-alarm', S.w.startAlarmLevel);
        syncSeg('start-threat', S.w.startThreatLevel);
        syncSeg('start-cdc', S.w.startCDCAlert);
        syncSeg('live-alarm', S.w.currentAlarmLevel);
        syncSeg('live-threat', S.w.currentThreatLevel);
        syncSeg('live-cdc', S.w.currentCDCAlert);

        LogForm.renderClearanceOptions();
        LogForm.renderRoleOverrideGrid();
        CrossTest.reset();
        if (existingLog) CrossTest.fill(existingLog);

        this._activate('view-form');
        FormNav.setActive('#sec-subject');
        document.querySelector('.form-panels').scrollTop = 0;
        FormNav.observe();
    },

    showDetail(id) {
        Timer.reset();
        S.currentId = id;
        const log = S.logs.find(l => l.id === id);
        if (!log) { Toast.show('Log not found', 'error'); return; }
        Detail.render(log);
        this._activate('view-detail');
    },

    async showBoard() {
        Drawer.close();
        try { await loadAll(); } catch { /* keep whatever is cached */ }
        ContainmentBoard.render();
        this._activate('view-board');
    },

    _activate(id) {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('is-active'));
        document.getElementById(id).classList.add('is-active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
};

/* ═══════════════════════════════════════════════════════════════════════════
   ACTION DISPATCH  (single delegated click handler)
   ═══════════════════════════════════════════════════════════════════════ */
function handleAction(action, el) {
    const d = el.dataset;
    switch (action) {
        case 'new-log': Views.showCreate(); break;
        case 'go-dashboard': Views.showDashboard(); break;
        case 'toggle-drawer': Drawer.toggle(); break;
        case 'close-modal': Modal.closeTop(); break;
        case 'open-modal':
            if (d.opsAction && !Session.can(d.opsAction)) { denyOpsAction(d.opsAction); break; }
            Drawer.close();
            if (d.modal === 'breach') OpsConsole.openBreachModal();
            else if (d.modal === 'breach-end') OpsConsole.openBreachEndModal();
            else if (d.modal === 'alarm') { OpsConsole.renderOptionGrid('alarmOptionGrid', ALARM_OPTS, 'submit-alarm'); Modal.open('alarm'); }
            else if (d.modal === 'threat') { OpsConsole.renderOptionGrid('threatOptionGrid', THREAT_OPTS, 'submit-threat'); Modal.open('threat'); }
            else if (d.modal === 'cdc') { OpsConsole.renderOptionGrid('cdcOptionGrid', CDC_OPTS, 'submit-cdc'); Modal.open('cdc'); }
            else if (d.modal === 'schedule') Scheduling.openCreateModal();
            else if (d.modal === 'schedule-list') Scheduling.openListModal();
            else Modal.open(d.modal);
            break;
        case 'cdc-riot':
            if (!Session.can('MANAGE:CDC_RIOT')) { denyOpsAction('MANAGE:CDC_RIOT'); break; }
            Drawer.close(); OpsConsole.submitCdcRiot(); break;

        case 'pick-scp': ScpPicker.select(d.mode, d.num); break;
        case 'seg-pick':
            if (d.group.startsWith('start-') || d.group.startsWith('live-')) AlertPanel.pick(d.group, d.value);
            else if (d.group === 'final-status') LogForm.setFinalStatus(d.value);
            else if (d.group === 'sub-status') LogForm.setSubStatus(d.value);
            break;
        case 'num-pick': Casualties.setField(d.field, parseInt(d.value)); break;
        case 'num-step': {
            const input = document.getElementById(d.target);
            const min = parseInt(input.min) || 0;
            const max = parseInt(input.max) || 99;
            const next = Math.min(max, Math.max(min, (parseInt(input.value) || 0) + parseInt(d.dir)));
            input.value = next;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            break;
        }

        case 'nav-jump': FormNav.jumpTo(d.target); break;
        case 'save-draft': LogForm.saveDraft(); break;
        case 'submit-log': LogForm.submit(); break;
        case 'start-timer': Timer.start(); break;
        case 'stop-timer': Timer.stop(); break;
        case 'log-timeline-event': Timeline.addEvent(d.event, 'event'); break;
        case 'add-manual': Timeline.addManual(); break;

        case 'open-log': Views.showDetail(d.id); break;
        case 'edit-log': { const log = S.logs.find(l => l.id === d.id); if (log) Views.showCreate(log); break; }
        case 'export-log': Dashboard.exportLog(d.id); break;
        case 'delete-log': Dashboard.deleteLog(d.id); break;
        case 'delete-event': Dashboard.deleteEvent(d.id); break;

        case 'copy-current':
            if (S.currentId) {
                navigator.clipboard?.writeText(S.currentId).then(() => Toast.show(I18n.t('toasts.id_copied'), 'success'));
            }
            break;
        case 'export-current': if (S.currentId) Dashboard.exportLog(S.currentId); break;
        case 'edit-current': { const log = S.logs.find(l => l.id === S.currentId); if (log) Views.showCreate(log); break; }
        case 'delete-current': if (S.currentId) Dashboard.deleteLog(S.currentId); break;

        case 'submit-breach': OpsConsole.submitBreach(); break;
        case 'end-breach': OpsConsole.submitBreachEnd(d.id, d.scp); break;
        case 'submit-broadcast': OpsConsole.submitBroadcast(); break;
        case 'submit-nuke': OpsConsole.submitNuke(d.key); break;
        case 'submit-alarm': OpsConsole.submitAlarm(d.value); break;
        case 'submit-threat': OpsConsole.submitThreat(d.value); break;
        case 'submit-cdc': OpsConsole.submitCdc(d.value); break;
        case 'submit-import': OpsConsole.submitImport(); break;

        case 'confirm-yes': ConfirmDialog.resolve(true); break;
        case 'confirm-no': ConfirmDialog.resolve(false); break;
        case 'confirm-termination': TerminationConfirm.confirm(); break;
        case 'cancel-termination': TerminationConfirm.cancel(); break;

        case 'fault-toggle-advanced': SystemOverlay.toggleAdvanced(); break;
        case 'fault-apply-base': SystemOverlay.applyBase(); break;
        case 'fault-retry': window.location.reload(); break;
        case 'fault-dismiss': SystemOverlay.hide(); break;

        case 'show-signin-mode': LoginView.showMode('signin'); break;
        case 'show-register-mode': LoginView.showMode('register'); break;
        case 'submit-login': LoginView.submitLogin(); break;
        case 'submit-register': LoginView.submitRegister(); break;
        case 'submit-change-password': ChangePasswordView.submit(); break;
        case 'toggle-session-menu': document.getElementById('sessionMenu').classList.toggle('is-open'); break;
        case 'logout': doLogout(); break;

        case 'show-board': Views.showBoard(); break;
        case 'show-admin': Views.showAdmin(); break;
        case 'show-broadcast': Views.showBroadcast(); break;
        case 'board-open-scp':
            document.getElementById('filterSearch').value = d.scp;
            Views.showDashboard();
            break;
        case 'resolve-containment': ContainmentBoard.resolve(d.scp, d.status); break;

        case 'toggle-role-override-menu': document.getElementById('roleOverrideGrid').classList.toggle('hidden'); break;
        case 'remove-cross-scp': CrossTest.remove(d.num); break;

        case 'submit-schedule': Scheduling.submitCreate(); break;
        case 'delete-schedule': Scheduling.remove(d.id); break;

        case 'toggle-session-group': {
            FacilitySession.toggleCollapsed(d.sessionId);
            document.querySelector(`.session-group[data-session-id="${CSS.escape(d.sessionId)}"]`)?.classList.toggle('is-collapsed');
            break;
        }
        case 'new-log-session': FacilitySession.startNew(); break;

        case 'admin-reset-password': Admin.resetPassword(d.id); break;
        case 'admin-delete-user': Admin.deleteUser(d.id); break;
        case 'admin-switch-tab': Admin._switchTab(d.tab); break;
        case 'admin-edit-permissions': Admin.openUserPermissionEditor(d.id); break;
        case 'admin-save-role-permissions': Admin.saveRolePermissions(); break;
        case 'admin-reset-role-permissions': Admin.resetRolePermissions(); break;
        case 'admin-save-user-permissions': Admin.saveUserPermissions(); break;
        case 'admin-reset-user-permissions': Admin.resetUserPermissions(); break;

        case 'pdf-current': { const log = S.logs.find(l => l.id === S.currentId); if (log) ReportGenerator.generateLogReport(log); break; }
        case 'pdf-event': { const ev = S.events.find(e => e.id === d.id); if (ev) ReportGenerator.generateBreachReport(ev); break; }
        default: break;
    }
}

async function doLogout() {
    try { await Api.logout(); } catch { /* proceed with local logout regardless */ }
    RealtimeFeed.disconnect();
    Session.clear();
    Toast.show('Session ended', 'info');
    Views.showLogin();
}

/* ═══════════════════════════════════════════════════════════════════════════
   KEYBOARD SHORTCUTS
   ═══════════════════════════════════════════════════════════════════════ */
/** Mirrors the server's 403 response for a gated Ops Console action the
 *  current role can't perform — shown immediately, client-side, instead
 *  of waiting for a round trip the server would reject anyway. */
function denyOpsAction(action) {
    const msg = `${Session.roleName} (${Session.roleCode}) is missing the required permission: ${action}.`;
    Toast.show(msg, 'error');
    SystemOverlay.show(new Error(msg), 'FORBIDDEN', 'forbidden');
}

function isTypingTarget(el) {
    return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
}

function initShortcuts() {
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            if (Modal.current) Modal.close();
            else if (Drawer.isOpen()) Drawer.close();
            return;
        }
        if (isTypingTarget(document.activeElement)) return;
        if (e.key === '/' && document.getElementById('view-dashboard').classList.contains('is-active')) {
            e.preventDefault();
            document.getElementById('filterSearch').focus();
        } else if (e.key === 'n') {
            e.preventDefault();
            Views.showCreate();
        } else if (e.key === 'o') {
            e.preventDefault();
            Drawer.toggle();
        }
    });
}

/* ═══════════════════════════════════════════════════════════════════════════
   WIRING
   ═══════════════════════════════════════════════════════════════════════ */
function wireStaticListeners() {
    // Delegated click handling for every data-action element (static or dynamic)
    document.addEventListener('click', e => {
        const el = e.target.closest('[data-action]');
        if (!el) return;
        e.preventDefault();
        handleAction(el.dataset.action, el);
    });

    // Backdrop clicks close their modal / the drawer
    document.querySelectorAll('.modal-layer').forEach(layer => {
        layer.addEventListener('click', e => { if (e.target === layer) Modal.closeTop(); });
    });
    document.getElementById('scrim').addEventListener('click', () => Drawer.close());

    // SCP picker input/keydown (main form + breach/schedule/cross-test modals)
    document.getElementById('scpSearchInput').addEventListener('input', () => ScpPicker.filter('main'));
    document.getElementById('scpSearchInput').addEventListener('keydown', e => ScpPicker.keyNav('main', e));
    document.getElementById('breachScpSearch').addEventListener('input', () => ScpPicker.filter('breach'));
    document.getElementById('breachScpSearch').addEventListener('keydown', e => ScpPicker.keyNav('breach', e));
    document.getElementById('scheduleScpSearch').addEventListener('input', () => ScpPicker.filter('schedule'));
    document.getElementById('scheduleScpSearch').addEventListener('keydown', e => ScpPicker.keyNav('schedule', e));
    document.getElementById('crossScpSearch').addEventListener('input', () => ScpPicker.filter('cross'));
    document.getElementById('crossScpSearch').addEventListener('keydown', e => ScpPicker.keyNav('cross', e));

    // Close on outside click
    document.addEventListener('click', e => {
        if (!e.target.closest('.picker')) ScpPicker.closeAll();
        if (!e.target.closest('.session-badge')) document.getElementById('sessionMenu')?.classList.remove('is-open');
        if (!e.target.closest('#roleOverrideToggle') && !e.target.closest('#roleOverrideGrid')) document.getElementById('roleOverrideGrid')?.classList.add('hidden');
    });
    // Close on blur too (e.g. Tab away) — delayed so a click on a
    // picker-item still registers before the dropdown disappears.
    document.getElementById('scpSearchInput').addEventListener('blur', () => setTimeout(() => ScpPicker.close('main'), 150));
    document.getElementById('breachScpSearch').addEventListener('blur', () => setTimeout(() => ScpPicker.close('breach'), 150));
    document.getElementById('scheduleScpSearch').addEventListener('blur', () => setTimeout(() => ScpPicker.close('schedule'), 150));
    document.getElementById('crossScpSearch').addEventListener('blur', () => setTimeout(() => ScpPicker.close('cross'), 150));
    // A fixed-position dropdown must close (rather than go stale) on
    // scroll/resize, since its coordinates were computed once on open.
    window.addEventListener('scroll', () => ScpPicker.closeAll(), true);
    window.addEventListener('resize', () => ScpPicker.closeAll());

    // Manual timeline entry — Enter key
    document.getElementById('fManualEntry').addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); Timeline.addManual(); }
    });

    // Personnel count inputs re-render the casualty seg bars
    ['fCd', 'fSd', 'fMtf', 'fRrt'].forEach(id => {
        document.getElementById(id).addEventListener('input', () => Casualties.renderAll());
    });

    // Signature updates live as researcher/rank are typed
    document.getElementById('fResearcher').addEventListener('input', () => LogForm.updateSignature());
    document.getElementById('fRank').addEventListener('input', () => LogForm.updateSignature());

    // Dashboard filters
    const rerender = debounce(() => Dashboard.render(), 120);
    document.getElementById('filterSearch').addEventListener('input', rerender);
    document.getElementById('filterStatus').addEventListener('change', () => Dashboard.render());
    document.getElementById('filterClass').addEventListener('change', () => Dashboard.render());
    document.getElementById('filterAlarm').addEventListener('change', () => Dashboard.render());
    document.getElementById('filterBreachOnly').addEventListener('change', e => {
        document.getElementById('breachOnlyChip').classList.toggle('is-on', e.target.checked);
        Dashboard.render();
    });
    document.getElementById('sortLogs').addEventListener('change', e => { S.dashboard.sort = e.target.value; Dashboard.render(); });

    // Login / register / change-password screens
    document.getElementById('loginRememberMe').addEventListener('change', e => {
        document.getElementById('rememberMeChip').classList.toggle('is-on', e.target.checked);
    });
    ['loginUsername', 'loginPassword'].forEach(id => {
        document.getElementById(id).addEventListener('keydown', e => { if (e.key === 'Enter') LoginView.submitLogin(); });
    });
    ['regUsername', 'regDisplayName', 'regPassword'].forEach(id => {
        document.getElementById(id).addEventListener('keydown', e => { if (e.key === 'Enter') LoginView.submitRegister(); });
    });
    ['pwOld', 'pwNew'].forEach(id => {
        document.getElementById(id).addEventListener('keydown', e => { if (e.key === 'Enter') ChangePasswordView.submit(); });
    });

    // Containment status board filters
    const rerenderBoard = debounce(() => ContainmentBoard.render(), 120);
    document.getElementById('boardSearch').addEventListener('input', rerenderBoard);
    document.getElementById('boardStatusFilter').addEventListener('change', () => ContainmentBoard.render());

    // Admin permission matrix — role selector
    document.getElementById('permRoleSelect').addEventListener('change', e => Admin.selectRole(e.target.value));

    initShortcuts();
}

/* ═══════════════════════════════════════════════════════════════════════════
   BOOT
   ═══════════════════════════════════════════════════════════════════════ */
(async () => {
    console.log('SSRP: booting…');
    try {
        await I18n.init();
        wireStaticListeners();
        StatusStrip.startClock();
        Heartbeat.start();

        if (Session.loadPersisted()) {
            try {
                const who = await Api.req('GET', '/api/auth/whoami', undefined, { skipQueue: true });
                Session.mustChangePassword = !!who.mustChangePassword;
                if (Session.mustChangePassword) Views.showChangePassword();
                else await Views.enterApp();
            } catch {
                Session.clear();
                await Views.showLogin();
            }
        } else {
            await Views.showLogin();
        }
        console.log('SSRP: online');
    } catch (err) {
        console.error('SSRP: fatal boot error', err);
        SystemOverlay.show(err, 'SYSTEM_BOOT_FAILURE', 'boot');
    }
})();
