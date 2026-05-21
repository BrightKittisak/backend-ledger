const { generatePublicId } = require('../../shared/utils/public-ids');
const { AppError } = require('../../shared/errors/app-error');
const { ERROR_CODES } = require('../../shared/errors/error-codes');
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

async function getTransactionByPublicId(publicTransactionId) {
  return TransactionModel.findOne({ publicTransactionId });
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

async function getTransactionViewByPublicIdForViewer({
  publicTransactionId,
  viewerAccountId,
}) {
  const transaction = await getTransactionByPublicId(publicTransactionId);

  if (
    !transaction ||
    ![transaction.fromAccountId.toString(), transaction.toAccountId.toString()].includes(
      viewerAccountId.toString(),
    )
  ) {
    throw new AppError({
      code: ERROR_CODES.NOT_FOUND,
      message: 'Transaction not found',
      statusCode: 404,
    });
  }

  return mapTransactionToView({
    transaction,
    viewerAccountId,
  });
}

async function getTransactionHistoryForAccount({ accountId, filters }) {
  const page = filters.page;
  const limit = filters.limit;
  const skip = (page - 1) * limit;

  const query = {
    $or: [{ fromAccountId: accountId }, { toAccountId: accountId }],
  };

  if (filters.type) {
    query.type = filters.type;
  }

  if (filters.from || filters.to) {
    query.createdAt = {};

    if (filters.from) {
      query.createdAt.$gte = new Date(filters.from);
    }

    if (filters.to) {
      query.createdAt.$lte = new Date(filters.to);
    }
  }

  const [items, totalItems] = await Promise.all([
    TransactionModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
    TransactionModel.countDocuments(query),
  ]);

  return {
    items: items.map((transaction) =>
      mapTransactionToView({
        transaction,
        viewerAccountId: accountId,
      }),
    ),
    limit,
    page,
    totalItems,
    totalPages: Math.max(1, Math.ceil(totalItems / limit)),
  };
}

module.exports = {
  createTransactionRecord,
  createTransferTransaction,
  getTransactionByPublicId,
  getTransactionHistoryForAccount,
  getTransactionView,
  getTransactionViewByPublicIdForViewer,
  getTransactionById,
};
