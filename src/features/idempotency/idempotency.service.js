const { AppError } = require('../../shared/errors/app-error');
const { ERROR_CODES } = require('../../shared/errors/error-codes');
const { hashValue } = require('../../shared/utils/security');
const { stableStringify } = require('../../shared/utils/stable-stringify');
const { IdempotencyRecordModel } = require('./idempotency.model');

const TTL_HOURS = 24;
const STALE_TIMEOUT_MS = 60 * 1000;

function buildIdempotencyRequestHash(payload) {
  return hashValue(stableStringify(payload));
}

function buildExpiryDate(now) {
  return new Date(now.getTime() + TTL_HOURS * 60 * 60 * 1000);
}

async function acquireIdempotencyRecord({ key, requestHash, userId }) {
  const now = new Date();

  try {
    const [record] = await IdempotencyRecordModel.create([
      {
        attemptCount: 1,
        expiresAt: buildExpiryDate(now),
        key,
        lastAttemptAt: now,
        requestHash,
        status: 'PROCESSING',
        userId,
      },
    ]);

    return {
      mode: 'PROCESS',
      record,
    };
  } catch (error) {
    if (error.code !== 11000) {
      throw error;
    }
  }

  const existingRecord = await IdempotencyRecordModel.findOne({ key, userId });

  if (!existingRecord) {
    return acquireIdempotencyRecord({ key, requestHash, userId });
  }

  if (existingRecord.requestHash !== requestHash) {
    throw new AppError({
      code: ERROR_CODES.IDEMPOTENCY_CONFLICT,
      message: 'This idempotency key is already used for a different request',
      statusCode: 409,
    });
  }

  if (existingRecord.status === 'COMPLETED') {
    return {
      mode: 'REPLAY',
      record: existingRecord,
    };
  }

  if (existingRecord.status === 'FAILED') {
    throw new AppError({
      code: ERROR_CODES.IDEMPOTENCY_PREVIOUSLY_FAILED,
      message: 'This idempotency key already failed. Retry with a new key.',
      statusCode: 409,
    });
  }

  if (now.getTime() - existingRecord.lastAttemptAt.getTime() <= STALE_TIMEOUT_MS) {
    throw new AppError({
      code: ERROR_CODES.IDEMPOTENCY_KEY_IN_USE,
      message: 'This request is already processing',
      statusCode: 409,
    });
  }

  const reclaimedRecord = await IdempotencyRecordModel.findOneAndUpdate(
    {
      _id: existingRecord._id,
      lastAttemptAt: existingRecord.lastAttemptAt,
      status: 'PROCESSING',
    },
    {
      $inc: {
        attemptCount: 1,
      },
      $set: {
        error: {
          code: null,
          lastFailedAt: null,
          message: null,
        },
        expiresAt: buildExpiryDate(now),
        lastAttemptAt: now,
      },
    },
    { returnDocument: 'after' },
  );

  if (!reclaimedRecord) {
    return acquireIdempotencyRecord({ key, requestHash, userId });
  }

  return {
    mode: 'PROCESS',
    record: reclaimedRecord,
  };
}

async function markIdempotencyCompleted({ recordId, session, transactionId }) {
  await IdempotencyRecordModel.updateOne(
    { _id: recordId },
    {
      $set: {
        status: 'COMPLETED',
        transactionId,
      },
    },
    { session },
  );
}

async function markIdempotencyFailed({ error, recordId }) {
  await IdempotencyRecordModel.updateOne(
    { _id: recordId },
    {
      $set: {
        error: {
          code: error.code ?? ERROR_CODES.INTERNAL_SERVER_ERROR,
          lastFailedAt: new Date(),
          message: error.message ?? 'Unexpected error',
        },
        status: 'FAILED',
      },
    },
  );
}

module.exports = {
  acquireIdempotencyRecord,
  buildIdempotencyRequestHash,
  markIdempotencyCompleted,
  markIdempotencyFailed,
};
