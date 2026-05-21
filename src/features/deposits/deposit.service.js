const { AccountModel } = require('../accounts/account.model');
const {
  getSystemAccount,
  getPrimaryAccountForUser,
  resolveDepositTargetByAccountNumber,
} = require('../accounts/account.service');
const {
  acquireIdempotencyRecord,
  buildIdempotencyRequestHash,
  markIdempotencyCompleted,
  markIdempotencyFailed,
} = require('../idempotency/idempotency.service');
const { LedgerEntryModel } = require('../ledger/ledger.model');
const { sendDepositSuccessEmail } = require('../notifications/email.service');
const {
  createTransactionRecord,
  getTransactionView,
} = require('../transactions/transaction.service');
const { runInTransaction } = require('../../shared/db/mongoose-session');
const { runWithTransactionRetries } = require('../../shared/db/transaction-retry');
const { AppError } = require('../../shared/errors/app-error');
const { ERROR_CODES } = require('../../shared/errors/error-codes');
const { maskFullName } = require('../../shared/utils/mask');

function normalizeDepositPayload({ amountMinor, metadata, toAccountNumber }) {
  return {
    amountMinor,
    metadata: {
      reason: metadata.reason,
    },
    toAccountNumber,
    type: 'DEPOSIT',
  };
}

async function createDeposit({
  amountMinor,
  idempotencyKey,
  initiatedByUser,
  metadata,
  toAccountNumber,
}) {
  if (initiatedByUser.role !== 'SYSTEM') {
    throw new AppError({
      code: ERROR_CODES.FORBIDDEN,
      message: 'Only system users can create deposits',
      statusCode: 403,
    });
  }

  const normalizedPayload = normalizeDepositPayload({
    amountMinor,
    metadata,
    toAccountNumber,
  });

  const idempotency = await acquireIdempotencyRecord({
    key: idempotencyKey,
    requestHash: buildIdempotencyRequestHash(normalizedPayload),
    userId: initiatedByUser._id,
  });

  const systemAccount = await getPrimaryAccountForUser(initiatedByUser._id);

  if (idempotency.mode === 'REPLAY') {
    const replayedTransaction = await getTransactionView({
      transactionId: idempotency.record.transactionId,
      viewerAccountId: systemAccount._id,
    });

    return {
      replayed: true,
      statusCode: 200,
      transaction: replayedTransaction,
    };
  }

  async function executeDepositTransaction() {
    return runInTransaction(async (session) => {
      const systemAccountInSession = await getSystemAccount(session);
      const targetAccount = await resolveDepositTargetByAccountNumber({
        accountNumber: toAccountNumber,
        session,
      });

      if (systemAccountInSession.currency !== targetAccount.currency) {
        throw new AppError({
          code: ERROR_CODES.CURRENCY_MISMATCH,
          message: 'Deposit requires both accounts to use the same currency',
          statusCode: 409,
        });
      }

      const updatedSystemAccount = await AccountModel.findByIdAndUpdate(
        systemAccountInSession._id,
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

      const updatedTargetAccount = await AccountModel.findByIdAndUpdate(
        targetAccount._id,
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

      const transaction = await createTransactionRecord({
        amountMinor,
        currency: systemAccountInSession.currency,
        fromAccount: systemAccountInSession,
        fromAccountBalanceAfterMinor: updatedSystemAccount.availableBalanceMinor,
        fromMaskedNameSnapshot: maskFullName(initiatedByUser.name),
        initiatedByUser,
        metadata: {
          reason: metadata.reason,
        },
        session,
        toAccount: targetAccount,
        toAccountBalanceAfterMinor: updatedTargetAccount.availableBalanceMinor,
        toMaskedNameSnapshot: maskFullName(targetAccount.userId.name),
        type: 'DEPOSIT',
      });

      await LedgerEntryModel.create(
        [
          {
            accountId: systemAccountInSession._id,
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

      return {
        targetAccount,
        transaction,
      };
    });
  }

  try {
    const created = await runWithTransactionRetries(executeDepositTransaction);
    const transactionView = await getTransactionView({
      transactionId: created.transaction._id,
      viewerAccountId: systemAccount._id,
    });

    await sendDepositSuccessEmail({
      amountMinor,
      currency: transactionView.currency,
      email: created.targetAccount.userId.email,
      name: created.targetAccount.userId.name,
      reason: metadata.reason,
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
  createDeposit,
};
