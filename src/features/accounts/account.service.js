const { AccountModel } = require('./account.model');
const { buildAccountSummary } = require('./account.mapper');
const { LedgerEntryModel } = require('../ledger/ledger.model');
const { config } = require('../../shared/config/env');
const { AppError } = require('../../shared/errors/app-error');
const { ERROR_CODES } = require('../../shared/errors/error-codes');
const { logger } = require('../../shared/logger/logger');
const { generateAccountNumber } = require('../../shared/utils/account-number');
const { generatePublicId } = require('../../shared/utils/public-ids');

async function generateUniqueAccountIdentity(session) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const publicAccountId = generatePublicId();
    const accountNumber = generateAccountNumber();

    const existingAccount = await AccountModel.findOne({
      $or: [{ accountNumber }, { publicAccountId }],
    }).session(session);

    if (!existingAccount) {
      return {
        accountNumber,
        publicAccountId,
      };
    }
  }

  throw new AppError({
    code: ERROR_CODES.INTERNAL_SERVER_ERROR,
    message: 'Unable to generate a unique account identity',
    statusCode: 500,
  });
}

async function createPrimaryAccount({ session, userId }) {
  const identity = await generateUniqueAccountIdentity(session);

  const [account] = await AccountModel.create(
    [
      {
        accountNumber: identity.accountNumber,
        availableBalanceMinor: 0,
        currency: config.appCurrency,
        publicAccountId: identity.publicAccountId,
        userId,
      },
    ],
    { session },
  );

  return account;
}

async function getLedgerBalanceForAccount(accountId) {
  const [balanceDocument] = await LedgerEntryModel.aggregate([
    { $match: { accountId } },
    {
      $group: {
        _id: null,
        totalCredit: {
          $sum: {
            $cond: [{ $eq: ['$direction', 'CREDIT'] }, '$amountMinor', 0],
          },
        },
        totalDebit: {
          $sum: {
            $cond: [{ $eq: ['$direction', 'DEBIT'] }, '$amountMinor', 0],
          },
        },
      },
    },
    {
      $project: {
        _id: 0,
        balance: {
          $subtract: ['$totalCredit', '$totalDebit'],
        },
      },
    },
  ]);

  return balanceDocument?.balance ?? 0;
}

async function mapAccountToSummary(account) {
  const currentBalanceMinor = await getLedgerBalanceForAccount(account._id);

  if (account.availableBalanceMinor !== currentBalanceMinor) {
    logger.error(
      {
        accountId: account._id.toString(),
        availableBalanceMinor: account.availableBalanceMinor,
        currentBalanceMinor,
        publicAccountId: account.publicAccountId,
      },
      'Account balance mismatch detected',
    );
  }

  return buildAccountSummary({
    account,
    currentBalanceMinor,
  });
}

async function getPrimaryAccountForUser(userId) {
  const account = await AccountModel.findOne({ userId });

  if (!account) {
    throw new AppError({
      code: ERROR_CODES.ACCOUNT_NOT_FOUND,
      message: 'Primary account not found',
      statusCode: 404,
    });
  }

  return account;
}

async function getPrimaryAccountSummaryForUser(userId) {
  const account = await getPrimaryAccountForUser(userId);
  return mapAccountToSummary(account);
}

async function getOwnedAccountSummaryByPublicId({ publicAccountId, userId }) {
  const account = await AccountModel.findOne({
    publicAccountId,
    userId,
  });

  if (!account) {
    throw new AppError({
      code: ERROR_CODES.ACCOUNT_NOT_FOUND,
      message: 'Account not found',
      statusCode: 404,
    });
  }

  return mapAccountToSummary(account);
}

module.exports = {
  createPrimaryAccount,
  getOwnedAccountSummaryByPublicId,
  getPrimaryAccountForUser,
  getPrimaryAccountSummaryForUser,
  mapAccountToSummary,
};
