/** Pairwise cross-contamination risk assessments. Keys are sorted,
 *  pipe-joined SCP numbers so lookup is order-independent. Undefined
 *  pairs fall back to an "unassessed" result rather than erroring —
 *  Foundation research doesn't have full coverage of every combination. */
const MATRIX = {
    '049|999': {
        risk: 'low',
        reason: 'SCP-049 will pet SCP-999 after some time. This is a peaceful, non-hostile interaction.'
    },
    '049|1025': {
        risk: 'moderate',
        reason: 'The Test Subject will turn into a 049-2 Instance, but 049 will not get triggered.'
    },
    "049|224": {
        risk: 'moderate',
        reason: 'The Test Subject will turn into a 049-2 Instance, but 049 will not get triggered.'
    },
    "049|569": {
        risk: 'moderate',
        reason: 'The Skull will paint 049\'s mask with a random color.'
    },
    "457|310": {
        risk: 'critical',
        reason: 'SCP-457 will become faster, bigger and purple after using the Sample of SCP-310 near him.'
    },
    "457|403": {
        risk: 'critical',
        reason: 'SCP-457 will become bigger after using SCP-403 near him.'
    },
    "076-2|096": {
        risk: 'forbidden',
        reason: 'SCP-076-2 will be killed by SCP-096.'
    },
    "076-2|610": {
        risk: 'forbidden',
        reason: 'SCP-076-2 will be killed by SCP-610_S Instance.'
    },
    "2006|076-2": {
        risk: 'forbidden',
        reason: 'SCP-2006 will transform into SCP-076-2.'
    },
    "2521|517": {
        risk: "high",
        reason: "SCP-517 will still kill the Test Subject, even in SCP-2521's dimension."
    },
    "2521|1139": {
        risk: "moderate",
        reason: "SCP-2521 will still take / kill the Test Subject, even with the effect of SCP-1139."
    },
    "035|569": {
        risk: "low",
        reason: "A Skull will paint 035's mask with a random color."
    },
    "323|714": {
        risk: "low",
        reason: "The Test Subject will wear SCP-323's mask, but due to SCP-714, they will be protected from its effects and transformation."
    },
    "323|008": {
        risk: "high",
        reason: "SCP-323 will be tinted by the infection and will onehit other Test Subjects / FP to transform them into a SCP-008 instance."
    },
    "323|409": {
        risk: "high",
        reason: "SCP-323 will be tinted by the infection and will onehit other Test Subjects / FP to transform them into a SCP-409 instance."
    },
    "1025|008": {
        risk: "critical",
        reason: "The Test Subject using SCP-1025 will turn into a SCP-008 instance."
    },
    "1025|409": {
        risk: "critical",
        reason: "The Test Subject using SCP-1025 will turn into a SCP-409 instance."
    },
    "1025|017": {
        risk: "critical",
        reason: "The Test Subject using SCP-1025 will be vaporized by SCP-017's effect."
    },
    "1025|610": {
        risk: "forbidden",
        reason: "The Test Subject using SCP-1025 will be transformed into any SCP-610 instance."
    },
    "939|207": {
        risk: "high",
        reason: "SCP-939 will be attracted to SCP-207."
    },
    "1370|017": {
        risk: "forbidden",
        reason: "SCP-1370 will destroy the generator."
    },
    "1370|2006": {
        risk: "forbidden",
        reason: "SCP-1370 tries to anger 2006 (staying in the RED circle)."
    },
    "1370|939": {
        risk: "forbidden",
        reason: "SCP-1370 will make loud sounds near the player to attract SCP-939."
    },
    "1370|096": {
        risk: "high",
        reason: "SCP-1370 will unbag 096 if bagged."
    },
    "1370|049": {
        risk: "high",
        reason: "SCP-1370 will anger 049."
    },
    "1370|403": {
        risk: "high",
        reason: "SCP-1370 will steal 403 from the player and tries to explode him."
    },
    "1370|207": {
        risk: "high",
        reason: "SCP-1370 will steal 207 from the player and drink it, becomming faster."
    },
    "1370|035":  {
        risk: "forbidden",
        reason: "SCP-137ß will turn into Doombot and kill everyone."
    },
    "1370|034": {
        risk: "low",
        reason: "SCP-1370 will snitch on the disguised player with specific text lines."
    }

};

function keyFor(a, b) {
    return [String(a), String(b)].sort().join('|');
}

/** Returns { risk, reason } for a pair, or an "unassessed" placeholder
 *  result (not a code placeholder — a real, meaningful default value)
 *  if Foundation research has no record for that combination. */
function assessPair(a, b) {
    if (String(a) === String(b)) return null;
    const hit = MATRIX[keyFor(a, b)];
    if (hit) return { scpA: a, scpB: b, ...hit };
    return { scpA: a, scpB: b, risk: 'unassessed', reason: 'No prior joint-containment research exists for this combination. Proceed under standard cross-test precautions.' };
}

/** Assesses every unordered pair among a set of SCPs (primary + cross subjects). */
function assessGroup(scpNumbers) {
    const unique = [...new Set(scpNumbers.map(String))];
    const results = [];
    for (let i = 0; i < unique.length; i++) {
        for (let j = i + 1; j < unique.length; j++) {
            results.push(assessPair(unique[i], unique[j]));
        }
    }
    return results;
}

module.exports = { assessPair, assessGroup };
