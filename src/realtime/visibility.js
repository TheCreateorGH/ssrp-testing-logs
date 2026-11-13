const permissionService = require('../services/permission.service');

function canViewLog(log, context) {
    const session = context.session;
    if (!session || !permissionService.matches(context.permissions, 'VIEW:TEST')) return false;
    if (session.clearance >= (log.viewClearance || 0)) return true;
    return Array.isArray(log.roleOverrides) && log.roleOverrides.includes(session.roleCode);
}

function canViewEvents(context) {
    return !!context.session && permissionService.matches(context.permissions, 'VIEW:EVENT');
}

function audienceFor(event, payload) {
    if (event === 'log:upsert') return context => canViewLog(payload, context);
    if (event === 'log:deleted') return context => canViewLog(payload._visibility || {}, context);
    if (event === 'event:created' || event === 'event:deleted') return canViewEvents;
    if (event === 'logsession:created') {
        return context => !!context.session && permissionService.matches(context.permissions, 'VIEW:TEST');
    }
    return () => true;
}

module.exports = { audienceFor };
