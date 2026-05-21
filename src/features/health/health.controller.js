const mongoose = require('mongoose');

const { sendSuccess } = require('../../shared/http/responses');
const { getRuntimeState } = require('../../shared/runtime/runtime-state');

function healthController(req, res) {
  return sendSuccess(res, {
    data: {
      status: 'ok',
    },
  });
}

function readinessController(req, res) {
  const runtimeState = getRuntimeState();
  const dbReady = mongoose.connection.readyState === 1;

  return sendSuccess(res, {
    data: {
      bootstrapReady: runtimeState.bootstrapReady,
      checks: {
        database: dbReady,
        email: {
          enabled: runtimeState.emailEnabled,
        },
      },
      ready: dbReady && runtimeState.bootstrapReady,
      status: dbReady && runtimeState.bootstrapReady ? 'ready' : 'not_ready',
    },
  });
}

module.exports = {
  healthController,
  readinessController,
};
