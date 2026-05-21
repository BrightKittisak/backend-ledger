const mongoose = require('mongoose');

const idempotencyRecordSchema = new mongoose.Schema(
  {
    attemptCount: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
    },
    error: {
      code: {
        type: String,
        default: null,
      },
      lastFailedAt: {
        type: Date,
        default: null,
      },
      message: {
        type: String,
        default: null,
      },
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    key: {
      type: String,
      required: true,
    },
    lastAttemptAt: {
      type: Date,
      required: true,
    },
    requestHash: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['PROCESSING', 'COMPLETED', 'FAILED'],
      required: true,
    },
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      ref: 'Transaction',
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  },
);

idempotencyRecordSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
idempotencyRecordSchema.index({ key: 1, userId: 1 }, { unique: true });

const IdempotencyRecordModel =
  mongoose.models.IdempotencyRecord ||
  mongoose.model('IdempotencyRecord', idempotencyRecordSchema);

module.exports = {
  IdempotencyRecordModel,
};
