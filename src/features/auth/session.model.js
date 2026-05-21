const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema(
  {
    csrfTokenHash: {
      type: String,
      required: true,
      select: false,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    refreshTokenHash: {
      type: String,
      required: true,
      select: false,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    rotatedAt: {
      type: Date,
      default: null,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const SessionModel = mongoose.models.Session || mongoose.model('Session', sessionSchema);

module.exports = {
  SessionModel,
};
