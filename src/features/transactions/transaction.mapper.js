const { maskBankAccountNumber } = require('../../shared/utils/mask');

function buildCounterparty({ transaction, viewerIsSource }) {
  if (transaction.type === 'TRANSFER') {
    return viewerIsSource
      ? {
          accountNumber: transaction.toAccountNumberSnapshot,
          displayName: transaction.toMaskedNameSnapshot,
        }
      : {
          accountNumber: transaction.fromAccountNumberSnapshot,
          displayName: transaction.fromMaskedNameSnapshot,
        };
  }

  if (transaction.type === 'DEPOSIT') {
    return viewerIsSource
      ? {
          accountNumber: transaction.toAccountNumberSnapshot,
          displayName: transaction.toMaskedNameSnapshot,
        }
      : {
          accountNumber: null,
          displayName: 'System Funding',
        };
  }

  return viewerIsSource
    ? {
        accountNumber: null,
        displayName: 'System Withdrawal',
      }
    : {
        accountNumber: transaction.fromAccountNumberSnapshot,
        displayName: transaction.fromMaskedNameSnapshot,
      };
}

function buildMetadata(transaction) {
  if (transaction.type === 'TRANSFER') {
    return {
      note: transaction.metadata?.note ?? null,
    };
  }

  if (transaction.type === 'DEPOSIT') {
    return {
      reason: transaction.metadata?.reason ?? null,
    };
  }

  return {
    bankAccountName: transaction.metadata?.bankAccountName ?? null,
    bankAccountNumber: transaction.metadata?.bankAccountNumber
      ? maskBankAccountNumber(transaction.metadata.bankAccountNumber)
      : null,
    bankName: transaction.metadata?.bankName ?? null,
    note: transaction.metadata?.note ?? null,
  };
}

function mapTransactionToView({ transaction, viewerAccountId }) {
  const viewerIsSource =
    transaction.fromAccountId.toString() === viewerAccountId.toString();

  return {
    amountMinor: transaction.amountMinor,
    balanceAfterMinor: viewerIsSource
      ? transaction.fromAccountBalanceAfterMinor
      : transaction.toAccountBalanceAfterMinor,
    counterparty: buildCounterparty({
      transaction,
      viewerIsSource,
    }),
    createdAt: transaction.createdAt,
    currency: transaction.currency,
    direction: viewerIsSource ? 'OUT' : 'IN',
    initiatedBy: {
      role: transaction.initiatedByRole,
    },
    metadata: buildMetadata(transaction),
    publicTransactionId: transaction.publicTransactionId,
    type: transaction.type,
  };
}

module.exports = {
  mapTransactionToView,
};
