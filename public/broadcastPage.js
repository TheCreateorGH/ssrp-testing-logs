const BROADCAST_MAX_LEN = 200 - "/broadcast ".length;

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
    'select#testingStatus': 'testingStatus',
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

function generateStatusMessage() {
    // 1. Werte aus den HTML-Elementen auslesen
    const alarmKey = document.getElementById('alarmType')?.value || 'none';
    const threatKey = document.getElementById('threadType')?.value || 'low';
    const cdcKey = document.getElementById('cdcStatus')?.value || 'off';
    
    // Spezifischer Selector für select#testingStatus, um den ID-Konflikt mit dem Wrapper-Div zu umgehen
    const testingSelect = document.querySelector('select#testingStatus');
    const testingKey = testingSelect?.value || '0';
    
    const heavyTestingKey = document.getElementById('dangerTestingStatus')?.value || '0';

    const breachCount = parseInt(document.getElementById('breachCount')?.value, 10) || 0;
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
    const breachStr = breachCount === 1 ? '1 Breach' : `${breachCount} Breaches`;
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
            setTimeout(() => {
                button.innerHTML = '<svg class="icon"><use href="#icon-copy"/></svg>';
            }, 2000);
            console.log('Text erfolgreich in die Zwischenablage kopiert.');
        } else {
            button.innerHTML = '<svg class="icon"><use href="#icon-alert-triangle"/></svg>';
            setTimeout(() => {
                button.innerHTML = '<svg class="icon"><use href="#icon-copy"/></svg>';
            }, 2000);
            console.error('Fehler beim Kopieren in die Zwischenablage.');
        }
    });
});

document.addEventListener('DOMContentLoaded', () => {
    updateDropdownColors();


    // Event-Listener an alle Input- und Select-Felder hängen
    const selectors = [
        '#alarmType',
        '#threadType',
        '#cdcStatus',
        '#breachCount',
        'select#testingStatus',
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
});