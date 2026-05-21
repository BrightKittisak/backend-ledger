const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    amountMinor: {
      type: Number,
      required: true,
      min: 1,
    },
    currency: {
      type: String,
      required: true,
    },
    fromAccountBalanceAfterMinor: {
      type: Number,
      required: true,
    },
    fromAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Account',
    },
    fromAccountNumberSnapshot: {
      type: String,
      required: true,
    },
    fromMaskedNameSnapshot: {
      type: String,
      required: true,
    },
    initiatedByRole: {
      type: String,
      enum: ['USER', 'SYSTEM'],
      required: true,
    },
    initiatedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    publicTransactionId: {
      type: String,
      required: true,
      unique: true,
    },
    toAccountBalanceAfterMinor: {
      type: Number,
      required: true,
    },
    toAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Account',
    },
    toAccountNumberSnapshot: {
      type: String,
      required: true,
    },
    toMaskedNameSnapshot: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['DEPOSIT', 'WITHDRAW', 'TRANSFER'],
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

transactionSchema.index({ createdAt: -1 });
transactionSchema.index({ fromAccountId: 1, createdAt: -1 });
transactionSchema.index({ toAccountId: 1, createdAt: -1 });

const TransactionModel =
  mongoose.models.Transaction || mongoose.model('Transaction', transactionSchema);

module.exports = {
  TransactionModel,
};
