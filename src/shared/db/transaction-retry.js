function isRetryableTransactionError(error) {
  return (
    error?.code === 112 ||
    error?.codeName === 'WriteConflict' ||
    error?.message?.includes('WriteConflict') ||
    error?.errorLabels?.includes('TransientTransactionError')
  );
}

async function runWithTransactionRetries(task, { maxAttempts = 3 } = {}) {
  let lastError;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;

      if (attempt >= maxAttempts - 1 || !isRetryableTransactionError(error)) {
        throw error;
      }
    }
  }

  throw lastError;
}

module.exports = {
  isRetryableTransactionError,
  runWithTransactionRetries,
};
