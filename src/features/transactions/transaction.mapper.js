function mapTransferTransactionToView({ transaction, viewerAccountId }) {
  const viewerIsSource =
    transaction.fromAccountId.toString() === viewerAccountId.toString();

  return {
    amountMinor: transaction.amountMinor,
    balanceAfterMinor: viewerIsSource
      ? transaction.fromAccountBalanceAfterMinor
      : transaction.toAccountBalanceAfterMinor,
    counterparty: viewerIsSource
      ? {
          accountNumber: transaction.toAccountNumberSnapshot,
          displayName: transaction.toMaskedNameSnapshot,
        }
      : {
          accountNumber: transaction.fromAccountNumberSnapshot,
          displayName: transaction.fromMaskedNameSnapshot,
        },
    createdAt: transaction.createdAt,
    currency: transaction.currency,
    direction: viewerIsSource ? 'OUT' : 'IN',
    initiatedBy: {
      role: transaction.initiatedByRole,
    },
    metadata: {
      note: transaction.metadata?.note ?? null,
    },
    publicTransactionId: transaction.publicTransactionId,
    type: transaction.type,
  };
}

module.exports = {
  mapTransferTransactionToView,
};
