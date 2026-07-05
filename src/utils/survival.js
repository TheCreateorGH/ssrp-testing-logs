/**
 * Survival rate = (personnel deployed - personnel lost) / personnel deployed.
 * Returns 100 when no personnel were deployed (nothing to lose).
 */
function calcSurvivalRate(log) {
    const p = log.personnel || {};
    const total = (p.cd || 0) + (p.sd || 0) + (p.mtf || 0) + (p.rrt || 0);
    if (!total) return 100;

    const c = log.casualties || {};
    const lost = (c.terminatedBySecurity || 0) + (c.killedBySCP || 0) + (c.personnelLost || 0);

    return Math.round(((total - Math.min(lost, total)) / total) * 100);
}

module.exports = { calcSurvivalRate };
