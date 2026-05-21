const mongoose = require('mongoose');

const ledgerEntrySchema = new mongoose.Schema(
  {
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      required: true,
      immutable: true,
      index: true,
    },
    amountMinor: {
      type: Number,
      required: true,
      immutable: true,
      min: 1,
    },
    direction: {
      type: String,
      required: true,
      enum: ['CREDIT', 'DEBIT'],
      immutable: true,
    },
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      immutable: true,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

const LedgerEntryModel =
  mongoose.models.LedgerEntry || mongoose.model('LedgerEntry', ledgerEntrySchema);

module.exports = {
  LedgerEntryModel,
};
