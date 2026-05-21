const { generatePublicId } = require('../../shared/utils/public-ids');
const { maskFullName } = require('../../shared/utils/mask');
const { TransactionModel } = require('./transaction.model');
const { mapTransferTransactionToView } = require('./transaction.mapper');

async function createTransferTransaction({
  amountMinor,
  createdAt,
  currency,
  fromAccount,
  fromAccountBalanceAfterMinor,
  initiatedByUser,
  metadata,
  session,
  toAccount,
  toAccountBalanceAfterMinor,
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
        fromMaskedNameSnapshot: maskFullName(initiatedByUser.name),
        initiatedByRole: initiatedByUser.role,
        initiatedByUserId: initiatedByUser._id,
        metadata,
        publicTransactionId: generatePublicId(),
        toAccountBalanceAfterMinor,
        toAccountId: toAccount._id,
        toAccountNumberSnapshot: toAccount.accountNumber,
        toMaskedNameSnapshot: maskFullName(toAccount.userId.name),
        type: 'TRANSFER',
      },
    ],
    { session },
  );

  return transaction;
}

async function getTransactionById(transactionId) {
  return TransactionModel.findById(transactionId);
}

async function getTransferTransactionView({ transactionId, viewerAccountId }) {
  const transaction = await getTransactionById(transactionId);

  if (!transaction) {
    return null;
  }

  return mapTransferTransactionToView({
    transaction,
    viewerAccountId,
  });
}

module.exports = {
  createTransferTransaction,
  getTransactionById,
  getTransferTransactionView,
};
