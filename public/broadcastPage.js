const BROADCAST_MAX_LEN = 200 - "/broadcast ".length;
const SCP_SESSION_KEY = 'ssrp_session';

const SCP_CLASS_ACCENTS = {
    safe: '#2ee6a6',
    euclid: '#ffcc4d',
    keter: '#ff3b5c'
};

const SCP_LOCATION_ORDER = ['c1', 'c2', 'cx', 'lcx'];
const SCP_CLASS_ORDER = ['safe', 'euclid', 'keter'];
const SCP_NAME_COLLATOR = new Intl.Collator(undefined, { sensitivity: 'base' });
const selectedScps = [];

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[char]));
}

function getStoredSessionToken() {
    try {
        const raw = sessionStorage.getItem(SCP_SESSION_KEY) || localStorage.getItem(SCP_SESSION_KEY);
        return raw ? JSON.parse(raw).token : null;
    } catch (error) {
        console.error('Unable to read the persisted SSRP session.', error);
        return null;
    }
}

function formatScpValue(value, fallback = 'Unassigned') {
    if (value === -1) return 'Unrestricted';
    if (value === null || value === undefined || value === '') return fallback;
    return String(value).toUpperCase();
}

function isScpBreached(scp) {
    return scp?.containmentStatus === 'breached'
        || scp?.status === 'breached'
        || scp?.breached === true;
}

function toggleScpSelection(scp) {
    const selectedIndex = selectedScps.indexOf(scp);
    if (selectedIndex === -1) {
        selectedScps.push(scp);
    } else {
        selectedScps.splice(selectedIndex, 1);
    }

    const card = document.querySelector(`.scp-card[data-scp="${CSS.escape(scp)}"]`);
    if (card) {
        const selected = selectedScps.includes(scp);
        card.classList.toggle('scp-card--selected', selected);
        card.setAttribute('aria-pressed', String(selected));
    }
    updateBroadcast();
}

function renderScpCards(scps) {
    const list = document.getElementById('scpList');
    const count = document.getElementById('scpCount');
    const entries = Object.entries(scps || {}).sort(([firstId, first], [secondId, second]) => {
        const breachOrder = Number(isScpBreached(second)) - Number(isScpBreached(first));
        if (breachOrder) return breachOrder;

        const firstLocation = SCP_LOCATION_ORDER.indexOf(String(first.location || '').toLowerCase());
        const secondLocation = SCP_LOCATION_ORDER.indexOf(String(second.location || '').toLowerCase());
        const locationOrder = (firstLocation === -1 ? SCP_LOCATION_ORDER.length : firstLocation)
            - (secondLocation === -1 ? SCP_LOCATION_ORDER.length : secondLocation);
        if (locationOrder) return locationOrder;

        const firstClass = SCP_CLASS_ORDER.indexOf(String(first.class || '').toLowerCase());
        const secondClass = SCP_CLASS_ORDER.indexOf(String(second.class || '').toLowerCase());
        const classOrder = (firstClass === -1 ? SCP_CLASS_ORDER.length : firstClass)
            - (secondClass === -1 ? SCP_CLASS_ORDER.length : secondClass);
        if (classOrder) return classOrder;

        const nameOrder = SCP_NAME_COLLATOR.compare(first.name || '', second.name || '');
        return nameOrder || SCP_NAME_COLLATOR.compare(firstId, secondId);
    });

    count.textContent = entries.length;
    if (!entries.length) {
        list.innerHTML = '<div class="scp-state">No SCP records available.</div>';
        return;
    }

    let hadBreachedCard = false;
    let insertedBreachedDivider = false;
    let insertedContainedDivider = false;
    list.innerHTML = entries.map(([id, scp], index) => {
        const classification = String(scp.class || 'unknown').toLowerCase();
        const accent = SCP_CLASS_ACCENTS[classification] || '#4d8dff';
        const breached = isScpBreached(scp);
        const divider = breached && !insertedBreachedDivider
            ? '<div class="scp-divider scp-divider--breached" role="separator"><span>Breached</span></div>'
            : !breached && hadBreachedCard && !insertedContainedDivider
                ? '<div class="scp-divider" role="separator"><span>Contained</span></div>'
                : '';
        insertedBreachedDivider = insertedBreachedDivider || Boolean(breached);
        insertedContainedDivider = insertedContainedDivider || (!breached && Boolean(divider));
        hadBreachedCard = hadBreachedCard || breached;
        return `${divider}
            <article class="scp-card${breached ? ' scp-card--breached' : ''}${selectedScps.includes(id) ? ' scp-card--selected' : ''}" data-scp="${escapeHtml(id)}" role="button" tabindex="0" aria-pressed="${selectedScps.includes(id)}" style="--scp-accent:${accent}; animation-delay:${Math.min(index, 12) * 25}ms">
                <div class="scp-card__top">
                    <span class="scp-card__id">SCP-${escapeHtml(id)}</span>
                    <span class="scp-card__class">${escapeHtml(classification)}</span>
                </div>
                <div class="scp-card__identity">
                    <h3 class="scp-card__name">${escapeHtml(scp.name || 'Unnamed anomaly')}</h3>
                    <span class="scp-card__signal" aria-hidden="true"></span>
                </div>
                <div class="scp-card__meta">
                    <div class="scp-card__meta-item">
                        <span class="scp-card__meta-label">Clearance</span>
                        <span class="scp-card__meta-value">${escapeHtml(formatScpValue(scp.clearance, 'Not set'))}</span>
                    </div>
                    <div class="scp-card__meta-item">
                        <span class="scp-card__meta-label">Location</span>
                        <span class="scp-card__meta-value">${escapeHtml(formatScpValue(scp.location))}</span>
                    </div>
                    <div class="scp-card__meta-item">
                        <span class="scp-card__meta-label">Sector</span>
                        <span class="scp-card__meta-value">${escapeHtml(formatScpValue(scp.sector))}</span>
                    </div>
                    <div class="scp-card__meta-item">
                        <span class="scp-card__meta-label">Record</span>
                        <span class="scp-card__meta-value${breached ? ' scp-card__record--breached' : ''}">${breached ? 'BREACHED' : 'CONTAINED'}</span>
                    </div>
                </div>
            </article>
        `;
    }).join('');
}

async function loadScpCatalog() {
    const list = document.getElementById('scpList');
    const token = getStoredSessionToken();
    if (!token) {
        list.innerHTML = '<div class="scp-state">Sign in through the console to load the catalog.</div>';
        return;
    }

    try {
        const headers = { 'X-Session-Token': token };
        const [catalogResponse, containmentResponse, eventsResponse] = await Promise.all([
            fetch('/api/scps', { headers }),
            fetch('/api/containment', { headers }),
            fetch('/api/events', { headers })
        ]);
        if (!catalogResponse.ok) throw new Error(`Catalog request failed (${catalogResponse.status})`);
        if (!containmentResponse.ok) throw new Error(`Containment request failed (${containmentResponse.status})`);
        if (!eventsResponse.ok) throw new Error(`Events request failed (${eventsResponse.status})`);

        const [catalog, containment, events] = await Promise.all([
            catalogResponse.json(),
            containmentResponse.json(),
            eventsResponse.json()
        ]);
        const endedBreachIds = new Set(
            events.filter(event => event.type === 'BREACH_END').map(event => event.linkedEventId)
        );
        const activeBreachScps = new Set(
            events
                .filter(event => ['BREACH', 'CDC_RIOT'].includes(event.type) && !endedBreachIds.has(event.id))
                .map(event => event.scp)
                .filter(Boolean)
        );
        const records = Object.fromEntries(Object.entries(catalog).map(([id, scp]) => [
            id,
            {
                ...scp,
                containmentStatus: containment[id]?.status
                    || (activeBreachScps.has(id) ? 'breached' : undefined)
            }
        ]));
        renderScpCards(records);
    } catch (error) {
        console.error('Unable to load SCP catalog.', error);
        list.innerHTML = '<div class="scp-state">Catalog unavailable. Return to the console and retry.</div>';
    }
}

// Mapping-Tabellen zur Umwandlung der HTML-Option-Values in die Python-Textformate
const ALARM_MAP = {
    'none': 'None',
    'cd': 'Class-D',
    'ci': 'Chaos',
    'breach': 'Breach',
    'lockdown': 'Lockdown'
};

const THREAT_MAP = {
    'low': 'Low',
    'medium': 'Medium',
    'high': 'High'
};

const CDC_MAP = {
    'off': 'Off',
    'on': 'On'
};

const TESTING_MAP = {
    '0': 'allowed',
    '1': 'with SiD+ allowance',
    '2': 'halted',
    '3': 'not allowed'
};

const COLORS = {
    "alarm": {
        "none": "#191b20",
        "cd": "#ff9142",
        "ci": "#2ee6a6",
        "breach": "#ff3b5c",
        "lockdown": "#4d8dff",
    },
    "thread": {
        "low": "#2ee6a6",
        "medium": "#ffb020",
        "high": "#ff3b5c",
    },
    "cdc": {
        "off": "#2ee6a6",
        "on": "#ff3b5c",
    },
    "testingStatus": {
        "0": "#2ee6a6",
        "1": "#ffb020",
        "2": "#ff9142",
        "3": "#ff3b5c",
    }
};

// Map input elements to their corresponding color category key
const SELECT_COLOR_MAPPINGS = {
    '#alarmType': 'alarm',
    '#threadType': 'thread',
    '#cdcStatus': 'cdc',
    '#testingStatus': 'testingStatus',
    '#dangerTestingStatus': 'testingStatus'
};

/**
 * Wandelt einen Hex-Farbcode (#RRGGBB) in einen RGBA-String mit Transparenz um.
 */
function hexToRgba(hex, alpha = 0.22) {
    if (!hex || hex.charAt(0) !== '#') return hex;
    
    let c = hex.substring(1);
    if (c.length === 3) {
        c = c.split('').map(char => char + char).join('');
    }
    
    const r = parseInt(c.substring(0, 2), 16) || 0;
    const g = parseInt(c.substring(2, 4), 16) || 0;
    const b = parseInt(c.substring(4, 6), 16) || 0;
    
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Calculates whether black or white text provides better contrast for a given hex color.
 * @param {string} hexColor - Color code in hex format (e.g., #2ee6a6)
 * @returns {string} - '#0a0b0d' for dark text or '#ffffff' for white text
 */
function getContrastTextColor(hexColor) {
    if (!hexColor || hexColor.charAt(0) !== '#') return '#ffffff';
    
    let hex = hexColor.substring(1);
    if (hex.length === 3) {
        hex = hex.split('').map(c => c + c).join('');
    }
    
    const r = parseInt(hex.substring(0, 2), 16) || 0;
    const g = parseInt(hex.substring(2, 4), 16) || 0;
    const b = parseInt(hex.substring(4, 6), 16) || 0;
    
    // Calculate relative luminance formula
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 128 ? '#0a0b0d' : '#ffffff';
}

/**
 * Updates dropdown background, text colors, and transparent background according to the selected option.
 */
function updateDropdownColors() {
    Object.entries(SELECT_COLOR_MAPPINGS).forEach(([selector, colorCategory]) => {
        const selectEl = document.querySelector(selector);
        if (!selectEl) return;

        const val = selectEl.value;
        const color = COLORS[colorCategory]?.[val];

        if (color) {
            selectEl.style.backgroundColor = hexToRgba(color, 0.22);
            selectEl.style.borderColor = color;
            selectEl.style.color = '#ffffff'; // Weißer Text für gute Lesbarkeit auf transparentem Dunkel-Glow
        } else {
            selectEl.style.backgroundColor = '';
            selectEl.style.borderColor = '';
            selectEl.style.color = '';
        }
    });
}

function formatBreachStatus() {
    if (selectedScps.length > 3) return 'Multiple breaches';
    if (selectedScps.length === 0) return 'No breaches';
    return `${selectedScps.join(', ')} breached`;
}

function generateStatusMessage() {
    // 1. Werte aus den HTML-Elementen auslesen
    const alarmKey = document.getElementById('alarmType')?.value || 'none';
    const threatKey = document.getElementById('threadType')?.value || 'low';
    const cdcKey = document.getElementById('cdcStatus')?.value || 'off';
    
    const testingSelect = document.getElementById('testingStatus');
    const testingKey = testingSelect?.value || '0';
    
    const heavyTestingKey = document.getElementById('dangerTestingStatus')?.value || '0';

    const ciCount = parseInt(document.getElementById('ciCount')?.value, 10) || 0;
    const cdCount = parseInt(document.getElementById('cdCount')?.value, 10) || 0;
    const notesInput = document.getElementById('broadcastText');

    // 2. Werte mappen
    const alarm = ALARM_MAP[alarmKey] || 'None';
    const threat = THREAT_MAP[threatKey] || 'Low';
    const cdc = CDC_MAP[cdcKey] || 'Off';
    const testingStatus = TESTING_MAP[testingKey] || 'allowed';
    const heavyTestingStatus = TESTING_MAP[heavyTestingKey] || 'allowed';

    // 3. Status-String gemäß Python-Logik zusammensetzen
    const breachStr = formatBreachStatus();
    const testingStr = `Testing ${testingStatus}`;
const heavyTestingStr = `CX + LCX Testing ${heavyTestingStatus}`;

    // Max. verfügbare Zeichenlänge für die Notes ermitteln
    const templateBase = `SITE STATUS | Alarm: ${alarm} | Threat: ${threat} | CDC: ${cdc} | ${breachStr} | ${testingStr} | ${heavyTestingStr} | ${ciCount} CI + ${cdCount} CD |  | S.C.P.`;
    const maxNotesLen = Math.max(0, BROADCAST_MAX_LEN - templateBase.length);

    // Maxlength dynamisch auf das Input-Feld anwenden & Text kürzen, falls nötig
    if (notesInput) {
        notesInput.maxLength = maxNotesLen;
        if (notesInput.value.length > maxNotesLen) {
            notesInput.value = notesInput.value.slice(0, maxNotesLen);
        }
    }

    const notes = (notesInput?.value || '').trim();
    const notesStr = notes ? ` | ${notes}` : '';

    return `SITE STATUS | Alarm: ${alarm} | Threat: ${threat} | CDC: ${cdc} | ${breachStr} | ${testingStr} | ${heavyTestingStr} | ${ciCount} CI + ${cdCount} CD${notesStr} | S.C.P.`;
}

function updateBroadcast() {
    const outputElement = document.getElementById('broadcastOutput');
    const commandOutputElement = document.getElementById('broadcastCommandOutput');
    if (outputElement) {
        outputElement.textContent = generateStatusMessage();
    }
    if (commandOutputElement) {
        commandOutputElement.textContent = `/broadcast ${generateStatusMessage()}`;
    }
    updateDropdownColors();
    document.querySelectorAll('.output-box').forEach((box) => {
        box.classList.remove('is-updated');
        void box.offsetWidth;
        box.classList.add('is-updated');
    });
}

async function copyToClipboard(text) {
    if (!navigator.clipboard) {
        // Fallback für ältere Browser
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        return true;
    } else {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            console.error('Fehler beim Kopieren in die Zwischenablage:', err);
            return false;
        }
    }
}

document.getElementById("backToConsole").addEventListener("click", function () {
    document.location.href="/";
});

document.getElementById("generateBroadcast").addEventListener("click", function () {
    updateBroadcast();
});

const copyButtons = document.querySelectorAll('#copyBroadcast, #copyBroadcast2');
copyButtons.forEach(button => {
    button.addEventListener('click', async () => {
        const outputElement = document.getElementById('broadcastOutput');
        const commandOutputElement = document.getElementById('broadcastCommandOutput');
        const textToCopy = button.id === 'copyBroadcast' ? outputElement?.textContent : commandOutputElement?.textContent;

        const success = await copyToClipboard(textToCopy);
        if (success) {
            button.innerHTML = '<svg class="icon"><use href="#icon-tick"/></svg>';
            button.classList.add('is-copied');
            setTimeout(() => {
                button.innerHTML = '<svg class="icon"><use href="#icon-copy"/></svg>';
                button.classList.remove('is-copied');
            }, 2000);
            console.log('Text erfolgreich in die Zwischenablage kopiert.');
        } else {
            button.innerHTML = '<svg class="icon"><use href="#icon-alert-triangle"/></svg>';
            setTimeout(() => {
                button.innerHTML = '<svg class="icon"><use href="#icon-copy"/></svg>';
                button.classList.remove('is-copied');
            }, 2000);
            console.error('Fehler beim Kopieren in die Zwischenablage.');
        }
    });
});

document.addEventListener('DOMContentLoaded', () => {
    updateDropdownColors();
    loadScpCatalog();

    const scpList = document.getElementById('scpList');
    scpList?.addEventListener('click', event => {
        const card = event.target.closest('.scp-card');
        if (card) toggleScpSelection(card.dataset.scp);
    });
    scpList?.addEventListener('keydown', event => {
        const card = event.target.closest('.scp-card');
        if (card && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            toggleScpSelection(card.dataset.scp);
        }
    });


    // Event-Listener an alle Input- und Select-Felder hängen
    const selectors = [
        '#alarmType',
        '#threadType',
        '#cdcStatus',
        '#testingStatus',
        '#dangerTestingStatus',
        '#ciCount',
        '#cdCount',
        '#broadcastText'
    ];

    selectors.forEach(selector => {
        const el = document.querySelector(selector);
        if (el) {
            el.addEventListener('input', updateBroadcast);
            el.addEventListener('change', updateBroadcast);
        }
    });

    document.querySelectorAll('select').forEach(select => {
        select.addEventListener('change', () => {
            select.classList.remove('is-sliding');
            void select.offsetWidth;
            select.classList.add('is-sliding');
        });
    });
});