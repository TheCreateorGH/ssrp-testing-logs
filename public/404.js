function rand2(start, end) {
    const random_num = Math.floor(Math.random() * (end - start)) + start;
    return String(random_num).padStart(2, '0');
}

document.addEventListener('DOMContentLoaded', () => {
    function startClock() {
        const tick = () => {
            document.getElementById('statusClockBroken').textContent =  `${rand2(0, 24)}:${rand2(0, 60)}:${rand2(0, 60)} Z`;
        };
        tick();
        setInterval(tick, 1000);
    };

    startClock();

    const redactedElements = document.querySelectorAll('.redacted');

    // Zeichenpool für leicht transparente/blockierende Glitch-Zeichen
    const semiBlocks = ['░', '▒', '▓', '█'];

    redactedElements.forEach((el) => {
        const originalText = el.textContent;
        el.dataset.originalText = originalText;

        // Erzeugt den Zensur-String mit zufälligen Block-Zeichen
        function getRedactedString(length) {
            return Array.from({ length }, () => semiBlocks[Math.floor(Math.random() * semiBlocks.length)]).join('');
        }

        // Erzeugt eine teilweise Zensur (Reveal-Rate von minRatio bis maxRatio)
        function getPartialRevealText(text, revealRatio) {
            const chars = text.split('');
            const totalToReveal = Math.floor(chars.length * revealRatio);

            // Zufällige Indizes zum Aufdecken auswählen
            const revealIndices = new Set();
            while (revealIndices.size < totalToReveal && revealIndices.size < chars.length) {
                revealIndices.add(Math.floor(Math.random() * chars.length));
            }

            return chars.map((char, index) => {
                if (revealIndices.has(index)) {
                    return char;
                }
                return semiBlocks[Math.floor(Math.random() * (semiBlocks.length - 1))]; // Hauptsächlich durchscheinendere Blöcke
            }).join('');
        }

        function triggerGlitch() {
            el.classList.add('glitching');

            // Entscheidungs-Chance: 50% voller Glitch, 50% partieller Glitch
            const isPartial = Math.random() < 0.5;

            if (isPartial) {
                // Zufällige Reveal-Ratio zwischen 30% (0.3) und 90% (0.9)
                const revealRatio = Math.random() * (0.9 - 0.3) + 0.3;
                el.textContent = getPartialRevealText(originalText, revealRatio);
            } else {
                // Vollständiger Reveal
                el.textContent = originalText;
            }

            // Kurze Glitch-Dauer (50ms - 180ms)
            const glitchDuration = Math.floor(Math.random() * 130) + 50;

            setTimeout(() => {
                el.classList.remove('glitching');
                el.textContent = getRedactedString(originalText.length || 8);

                // Nächster Glitch in 1 bis 5 Sekunden
                const nextInterval = Math.floor(Math.random() * 400);
                setTimeout(triggerGlitch, nextInterval);
            }, glitchDuration);
        }

        // Initialer Zensur-Zustand
        el.textContent = getRedactedString(originalText.length || 8);

        const initialDelay = Math.floor(Math.random() * 2500) + 300;
        setTimeout(triggerGlitch, initialDelay);
    });
});

$(document.body).ready(function () {
    // Click trigger easter egg setup (click 5 times on '404')
    let clickCount = 0;
    const $trigger = $('#easterEggTrigger');
    const $termBox = $('#terminalContainer');
    const $toggleBtn = $('#toggleConsoleBtn');

    $trigger.on('click', function () {
        clickCount++;
        if (clickCount === 3) {
            $trigger.css('color', 'var(--caution)');
        } else if (clickCount >= 5) {
            clickCount = 0;
            $trigger.css('color', 'var(--clear)');
            openTerminal(true);
        }
    });

    $toggleBtn.on('click', function () {
        if ($termBox.hasClass('hidden')) {
            openTerminal(false);
        } else {
            $termBox.addClass('hidden');
        }
    });

    let termInitialized = false;

    function openTerminal(unlockedEasterEgg) {
        $termBox.removeClass('hidden');

        if (!termInitialized) {
            termInitialized = true;
            $('#easterEggTerminal').terminal({
                help: function () {
                    this.echo('AVAILABLE COMMANDS: help, status, scp-404, clear, override');
                },
                status: function () {
                    this.echo('[[b;red;]WARNING]: Sector 404 corrupted or erased from Site records.');
                },
                'scp-404': function () {
                    this.echo('[[b;yellow;]Item #:] SCP-404-NOT-FOUND');
                    this.echo('[[b;white;]Object Class:] Keter');
                    this.echo('[[b;white;]Description:] SCP-404 represents requested digital assets that cease to exist upon querying.');
                },
                override: function (password) {
                    if (password === 'O5-CLEARANCE' || unlockedEasterEgg) {
                        this.echo('[[b;green;]O5 CLEARANCE GRANTED.]');
                        this.echo('Easter Egg Unlocked: "There is no Site-13."');
                        this.echo('Redirecting to secure terminal...');
                        setTimeout(function () {
                            window.location.href = 'index.html';
                        }, 2000);
                    } else {
                        this.echo('[[b;red;]ACCESS DENIED. INCORRECT OVERRIDE CODE.]');
                    }
                }
            }, {
                greetings: unlockedEasterEgg
                    ? '=== [O5 LEVEL OVERRIDE GRANTED] ===\nType "scp-404" or "help" for information.'
                    : '=== SCP FOUNDATION EMERGENCY TERMINAL ===\nType "help" for command list.',
                prompt: unlockedEasterEgg ? 'O5-OVERRIDE@scpf:~$ ' : 'guest@scpf-404:~$ ',
                checkArity: false
            });
        }
    }
});