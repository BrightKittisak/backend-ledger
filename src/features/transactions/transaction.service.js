const { generatePublicId } = require('../../shared/utils/public-ids');
const { TransactionModel } = require('./transaction.model');
const { mapTransactionToView } = require('./transaction.mapper');

async function createTransactionRecord({
  amountMinor,
  createdAt,
  currency,
  fromAccount,
  fromAccountBalanceAfterMinor,
  fromMaskedNameSnapshot,
  initiatedByUser,
  metadata,
  session,
  toAccount,
  toAccountBalanceAfterMinor,
  toMaskedNameSnapshot,
  type,
}) {
  const [transaction] = await TransactionModel.create(
    [
      {
        amountMinor,
        createdAt,
        currency,
        fromAccountBalanceAfterMinor,
        fromAccountId: fromAccount._id,
        fromAccountNumberSnapshot: fromAccount.accountNumber,
        fromMaskedNameSnapshot,
        initiatedByRole: initiatedByUser.role,
        initiatedByUserId: initiatedByUser._id,
        metadata,
        publicTransactionId: generatePublicId(),
        toAccountBalanceAfterMinor,
        toAccountId: toAccount._id,
        toAccountNumberSnapshot: toAccount.accountNumber,
        toMaskedNameSnapshot,
        type,
      },
    ],
    { session },
  );

  return transaction;
}

async function createTransferTransaction({
  amountMinor,
  createdAt,
  currency,
  fromAccount,
  fromAccountBalanceAfterMinor,
  fromMaskedNameSnapshot,
  initiatedByUser,
  metadata,
  session,
  toAccount,
  toAccountBalanceAfterMinor,
  toMaskedNameSnapshot,
}) {
  return createTransactionRecord({
    amountMinor,
    createdAt,
    currency,
    fromAccount,
    fromAccountBalanceAfterMinor,
    fromMaskedNameSnapshot,
    initiatedByUser,
    metadata,
    session,
    toAccount,
    toAccountBalanceAfterMinor,
    toMaskedNameSnapshot,
    type: 'TRANSFER',
  });
}

async function getTransactionById(transactionId) {
  return TransactionModel.findById(transactionId);
}

async function getTransactionView({ transactionId, viewerAccountId }) {
  const transaction = await getTransactionById(transactionId);

  if (!transaction) {
    return null;
  }

  return mapTransactionToView({
    transaction,
    viewerAccountId,
  });
}

module.exports = {
  createTransactionRecord,
  createTransferTransaction,
  getTransactionView,
  getTransactionById,
};
