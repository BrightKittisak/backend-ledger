const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema(
  {
    accountNumber: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
    },
    availableBalanceMinor: {
      type: Number,
      default: 0,
      required: true,
    },
    currency: {
      type: String,
      required: true,
      uppercase: true,
    },
    publicAccountId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'FROZEN', 'CLOSED'],
      default: 'ACTIVE',
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      immutable: true,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

const AccountModel = mongoose.models.Account || mongoose.model('Account', accountSchema);

module.exports = {
  AccountModel,
};
