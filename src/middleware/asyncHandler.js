/**
 * Wraps an async route handler so that a thrown error / rejected
 * promise is forwarded to Express's error-handling middleware via
 * next(err), instead of every controller needing its own try/catch.
 *
 * Usage: router.get('/', asyncHandler(controller.list));
 */
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

module.exports = { asyncHandler };
