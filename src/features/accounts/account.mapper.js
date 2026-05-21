function buildAccountSummary({ account, currentBalanceMinor }) {
  return {
    accountNumber: account.accountNumber,
    currency: account.currency,
    currentBalanceMinor,
    publicAccountId: account.publicAccountId,
    status: account.status,
  };
}

module.exports = {
  buildAccountSummary,
};
