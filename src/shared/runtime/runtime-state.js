const { config } = require('../config/env');

const runtimeState = {
  bootstrapReady: false,
  emailEnabled: config.email.enabled,
};

function getRuntimeState() {
  return {
    ...runtimeState,
  };
}

function markBootstrapReady() {
  runtimeState.bootstrapReady = true;
}

function resetRuntimeState() {
  runtimeState.bootstrapReady = false;
  runtimeState.emailEnabled = config.email.enabled;
}

module.exports = {
  getRuntimeState,
  markBootstrapReady,
  resetRuntimeState,
};
