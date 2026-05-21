const { AccountModel } = require('../accounts/account.model');
const {
  getLedgerBalanceForAccount,
  getPrimaryAccountForUser,
  resolveTransferTargetByAccountNumber,
} = require('../accounts/account.service');
const {
  acquireIdempotencyRecord,
  buildTransferRequestHash,
  markIdempotencyCompleted,
  markIdempotencyFailed,
} = require('../idempotency/idempotency.service');
const { LedgerEntryModel } = require('../ledger/ledger.model');
const { sendTransferSuccessEmail } = require('../notifications/email.service');
const {
  createTransferTransaction,
  getTransferTransactionView,
} = require('../transactions/transaction.service');
const { runInTransaction } = require('../../shared/db/mongoose-session');
const { AppError } = require('../../shared/errors/app-error');
const { ERROR_CODES } = require('../../shared/errors/error-codes');

function normalizeTransferPayload({ amountMinor, metadata, toAccountNumber }) {
  return {
    amountMinor,
    metadata: {
      note: metadata?.note ?? null,
    },
    toAccountNumber,
    type: 'TRANSFER',
  };
}

function isRetryableTransferError(error) {
  return (
    error?.code === 112 ||
    error?.codeName === 'WriteConflict' ||
    error?.message?.includes('WriteConflict') ||
    error?.errorLabels?.includes('TransientTransactionError')
  );
}

async function createTransfer({
  amountMinor,
  idempotencyKey,
  initiatedByUser,
  metadata,
  toAccountNumber,
}) {
  const normalizedPayload = normalizeTransferPayload({
    amountMinor,
    metadata,
    toAccountNumber,
  });

  const idempotency = await acquireIdempotencyRecord({
    key: idempotencyKey,
    requestHash: buildTransferRequestHash(normalizedPayload),
    userId: initiatedByUser._id,
  });

  const sourceAccount = await getPrimaryAccountForUser(initiatedByUser._id);

  if (idempotency.mode === 'REPLAY') {
    const replayedTransaction = await getTransferTransactionView({
      transactionId: idempotency.record.transactionId,
      viewerAccountId: sourceAccount._id,
    });

    return {
      replayed: true,
      statusCode: 200,
      transaction: replayedTransaction,
    };
  }

  async function executeTransferTransaction() {
    return runInTransaction(async (session) => {
      const sourceAccountInSession = await getPrimaryAccountForUser(initiatedByUser._id, session);

      if (sourceAccountInSession.status !== 'ACTIVE') {
        throw new AppError({
          code: ERROR_CODES.ACCOUNT_NOT_ACTIVE,
          message: 'Source account is not active',
          statusCode: 409,
        });
      }

      const ledgerBalanceMinor = await getLedgerBalanceForAccount(sourceAccountInSession._id, session);

      if (sourceAccountInSession.availableBalanceMinor !== ledgerBalanceMinor) {
        throw new AppError({
          code: ERROR_CODES.ACCOUNT_BALANCE_MISMATCH,
          message: 'Source account balance is inconsistent',
          statusCode: 409,
        });
      }

      const targetAccount = await resolveTransferTargetByAccountNumber({
        accountNumber: toAccountNumber,
        requesterAccount: sourceAccountInSession,
        session,
      });

      if (sourceAccountInSession.currency !== targetAccount.currency) {
        throw new AppError({
          code: ERROR_CODES.TRANSFER_SAME_CURRENCY_REQUIRED,
          message: 'Transfer requires both accounts to use the same currency',
          statusCode: 409,
        });
      }

      const updatedSourceAccount = await AccountModel.findOneAndUpdate(
        {
          _id: sourceAccountInSession._id,
          availableBalanceMinor: {
            $gte: amountMinor,
          },
          status: 'ACTIVE',
        },
        {
          $inc: {
            availableBalanceMinor: -amountMinor,
          },
        },
        {
          returnDocument: 'after',
          session,
        },
      );

      if (!updatedSourceAccount) {
        throw new AppError({
          code: ERROR_CODES.INSUFFICIENT_FUNDS,
          message: 'Insufficient funds',
          statusCode: 409,
        });
      }

      const updatedTargetAccount = await AccountModel.findOneAndUpdate(
        {
          _id: targetAccount._id,
          status: 'ACTIVE',
        },
        {
          $inc: {
            availableBalanceMinor: amountMinor,
          },
        },
        {
          returnDocument: 'after',
          session,
        },
      );

      if (!updatedTargetAccount) {
        throw new AppError({
          code: ERROR_CODES.TRANSFER_DESTINATION_NOT_ACTIVE,
          message: 'Transfer destination account is not active',
          statusCode: 409,
        });
      }

      const transaction = await createTransferTransaction({
        amountMinor,
        currency: sourceAccountInSession.currency,
        fromAccount: sourceAccountInSession,
        fromAccountBalanceAfterMinor: updatedSourceAccount.availableBalanceMinor,
        initiatedByUser,
        metadata: {
          note: metadata?.note ?? null,
        },
        session,
        toAccount: targetAccount,
        toAccountBalanceAfterMinor: updatedTargetAccount.availableBalanceMinor,
      });

      await LedgerEntryModel.create(
        [
          {
            accountId: sourceAccountInSession._id,
            amountMinor,
            direction: 'DEBIT',
            transactionId: transaction._id,
          },
          {
            accountId: targetAccount._id,
            amountMinor,
            direction: 'CREDIT',
            transactionId: transaction._id,
          },
        ],
        { ordered: true, session },
      );

      await markIdempotencyCompleted({
        recordId: idempotency.record._id,
        session,
        transactionId: transaction._id,
      });

      return transaction;
    });
  }

  try {
    let createdTransaction;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        createdTransaction = await executeTransferTransaction();
        break;
      } catch (error) {
        if (attempt < 2 && isRetryableTransferError(error)) {
          continue;
        }

        throw error;
      }
    }

    const transactionView = await getTransferTransactionView({
      transactionId: createdTransaction._id,
      viewerAccountId: sourceAccount._id,
    });

    await sendTransferSuccessEmail({
      amountMinor,
      currency: transactionView.currency,
      email: initiatedByUser.email,
      name: initiatedByUser.name,
      toAccountNumber,
    });

    return {
      replayed: false,
      statusCode: 201,
      transaction: transactionView,
    };
  } catch (error) {
    await markIdempotencyFailed({
      error,
      recordId: idempotency.record._id,
    });

    throw error;
  }
}

module.exports = {
  createTransfer,
};
