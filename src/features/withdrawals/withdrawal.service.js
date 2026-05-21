const { AccountModel } = require('../accounts/account.model');
const {
  getLedgerBalanceForAccount,
  getPrimaryAccountForUser,
  getSystemAccount,
} = require('../accounts/account.service');
const {
  acquireIdempotencyRecord,
  buildIdempotencyRequestHash,
  markIdempotencyCompleted,
  markIdempotencyFailed,
} = require('../idempotency/idempotency.service');
const { LedgerEntryModel } = require('../ledger/ledger.model');
const { sendWithdrawalSuccessEmail } = require('../notifications/email.service');
const {
  createTransactionRecord,
  getTransactionView,
} = require('../transactions/transaction.service');
const { config } = require('../../shared/config/env');
const { runInTransaction } = require('../../shared/db/mongoose-session');
const { runWithTransactionRetries } = require('../../shared/db/transaction-retry');
const { AppError } = require('../../shared/errors/app-error');
const { ERROR_CODES } = require('../../shared/errors/error-codes');
const { maskFullName } = require('../../shared/utils/mask');

function normalizeWithdrawalPayload({ amountMinor, metadata }) {
  return {
    amountMinor,
    metadata: {
      bankAccountName: metadata.bankAccountName,
      bankAccountNumber: metadata.bankAccountNumber,
      bankName: metadata.bankName,
      note: metadata.note ?? null,
    },
    type: 'WITHDRAW',
  };
}

async function createWithdrawal({
  amountMinor,
  idempotencyKey,
  initiatedByUser,
  metadata,
}) {
  const normalizedPayload = normalizeWithdrawalPayload({
    amountMinor,
    metadata,
  });

  const idempotency = await acquireIdempotencyRecord({
    key: idempotencyKey,
    requestHash: buildIdempotencyRequestHash(normalizedPayload),
    userId: initiatedByUser._id,
  });

  const sourceAccount = await getPrimaryAccountForUser(initiatedByUser._id);

  if (idempotency.mode === 'REPLAY') {
    const replayedTransaction = await getTransactionView({
      transactionId: idempotency.record.transactionId,
      viewerAccountId: sourceAccount._id,
    });

    return {
      replayed: true,
      statusCode: 200,
      transaction: replayedTransaction,
    };
  }

  async function executeWithdrawalTransaction() {
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

      const systemAccount = await getSystemAccount(session);

      if (sourceAccountInSession.currency !== systemAccount.currency) {
        throw new AppError({
          code: ERROR_CODES.CURRENCY_MISMATCH,
          message: 'Withdrawal requires both accounts to use the same currency',
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

      const updatedSystemAccount = await AccountModel.findByIdAndUpdate(
        systemAccount._id,
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
        currency: sourceAccountInSession.currency,
        fromAccount: sourceAccountInSession,
        fromAccountBalanceAfterMinor: updatedSourceAccount.availableBalanceMinor,
        fromMaskedNameSnapshot: maskFullName(initiatedByUser.name),
        initiatedByUser,
        metadata: {
          bankAccountName: metadata.bankAccountName,
          bankAccountNumber: metadata.bankAccountNumber,
          bankName: metadata.bankName,
          note: metadata.note ?? null,
        },
        session,
        toAccount: systemAccount,
        toAccountBalanceAfterMinor: updatedSystemAccount.availableBalanceMinor,
        toMaskedNameSnapshot: maskFullName(config.systemUser.name),
        type: 'WITHDRAW',
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
            accountId: systemAccount._id,
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
    const createdTransaction = await runWithTransactionRetries(executeWithdrawalTransaction);
    const transactionView = await getTransactionView({
      transactionId: createdTransaction._id,
      viewerAccountId: sourceAccount._id,
    });

    await sendWithdrawalSuccessEmail({
      amountMinor,
      bankAccountNumber: metadata.bankAccountNumber,
      currency: transactionView.currency,
      email: initiatedByUser.email,
      name: initiatedByUser.name,
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
  createWithdrawal,
};
