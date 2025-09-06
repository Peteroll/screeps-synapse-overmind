module.exports = {
	LOG_TICK_INTERVAL: 20,
	DEBUG: false,
	NOTIFY_ON_ERROR: true,
	// how long to force builders to focus on container construction (ticks)
	FORCE_CONTAINER_BUILD_TICKS: 500,
	// body for settler/expander creeps
	SETTLER_BODY: [CLAIM, MOVE, MOVE, MOVE]
};
