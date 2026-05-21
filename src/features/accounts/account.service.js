const { AccountModel } = require('./account.model');
const { buildAccountSummary } = require('./account.mapper');
const { LedgerEntryModel } = require('../ledger/ledger.model');
const { config } = require('../../shared/config/env');
const { AppError } = require('../../shared/errors/app-error');
const { ERROR_CODES } = require('../../shared/errors/error-codes');
const { logger } = require('../../shared/logger/logger');
const { generateAccountNumber } = require('../../shared/utils/account-number');
const { maskFullName } = require('../../shared/utils/mask');
const { generatePublicId } = require('../../shared/utils/public-ids');
const { UserModel } = require('../users/user.model');

const LOOKUP_REASON_MESSAGES = {
  ACCOUNT_NOT_ACTIVE: 'This account exists but is not available for transfer',
  NOT_FOUND: 'No transferable account was found for this account number',
  OK: 'This account can receive transfers',
  OWN_ACCOUNT: 'You cannot transfer to your own account',
};

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

async function getLedgerBalanceForAccount(accountId, session) {
  const aggregation = LedgerEntryModel.aggregate([
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

  if (session) {
    aggregation.session(session);
  }

  const [balanceDocument] = await aggregation;

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

async function getPrimaryAccountForUser(userId, session) {
  let query = AccountModel.findOne({ userId });

  if (session) {
    query = query.session(session);
  }

  const account = await query;

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

async function getOwnedAccountByPublicId({ publicAccountId, session, userId }) {
  let query = AccountModel.findOne({
    publicAccountId,
    userId,
  });

  if (session) {
    query = query.session(session);
  }

  const account = await query;

  if (!account) {
    throw new AppError({
      code: ERROR_CODES.ACCOUNT_NOT_FOUND,
      message: 'Account not found',
      statusCode: 404,
    });
  }

  return account;
}

async function findAccountWithUserByAccountNumber(accountNumber, session) {
  let query = AccountModel.findOne({ accountNumber }).populate({
    model: UserModel,
    path: 'userId',
    select: 'email name role status',
  });

  if (session) {
    query = query.session(session);
  }

  return query.exec();
}

function buildLookupResponse({
  accountNumber,
  canTransfer,
  isOwnAccount,
  maskedAccountName = null,
  reasonCode,
}) {
  return {
    accountNumber,
    canTransfer,
    isOwnAccount,
    maskedAccountName,
    reason: {
      code: reasonCode,
      message: LOOKUP_REASON_MESSAGES[reasonCode],
    },
  };
}

async function getAccountLookupForUser({ accountNumber, requesterUser }) {
  const requesterAccount = await getPrimaryAccountForUser(requesterUser._id);
  const targetAccount = await findAccountWithUserByAccountNumber(accountNumber);

  if (!targetAccount || targetAccount.userId.role === 'SYSTEM') {
    return buildLookupResponse({
      accountNumber,
      canTransfer: false,
      isOwnAccount: false,
      reasonCode: 'NOT_FOUND',
    });
  }

  const maskedAccountName = maskFullName(targetAccount.userId.name);

  if (targetAccount._id.toString() === requesterAccount._id.toString()) {
    return buildLookupResponse({
      accountNumber,
      canTransfer: false,
      isOwnAccount: true,
      maskedAccountName,
      reasonCode: 'OWN_ACCOUNT',
    });
  }

  if (targetAccount.status !== 'ACTIVE') {
    return buildLookupResponse({
      accountNumber,
      canTransfer: false,
      isOwnAccount: false,
      maskedAccountName,
      reasonCode: 'ACCOUNT_NOT_ACTIVE',
    });
  }

  return buildLookupResponse({
    accountNumber,
    canTransfer: true,
    isOwnAccount: false,
    maskedAccountName,
    reasonCode: 'OK',
  });
}

async function resolveTransferTargetByAccountNumber({
  accountNumber,
  requesterAccount,
  session,
}) {
  const targetAccount = await findAccountWithUserByAccountNumber(accountNumber, session);

  if (!targetAccount || targetAccount.userId.role === 'SYSTEM') {
    throw new AppError({
      code: ERROR_CODES.TRANSFER_DESTINATION_NOT_FOUND,
      message: 'Transfer destination account was not found',
      statusCode: 404,
    });
  }

  if (targetAccount._id.toString() === requesterAccount._id.toString()) {
    throw new AppError({
      code: ERROR_CODES.SELF_TRANSFER_FORBIDDEN,
      message: 'Self transfer is not allowed',
      statusCode: 409,
    });
  }

  if (targetAccount.status !== 'ACTIVE') {
    throw new AppError({
      code: ERROR_CODES.TRANSFER_DESTINATION_NOT_ACTIVE,
      message: 'Transfer destination account is not active',
      statusCode: 409,
    });
  }

  return targetAccount;
}

async function getSystemAccount(session) {
  let systemUserQuery = UserModel.findOne({
    email: config.systemUser.email,
    role: 'SYSTEM',
    status: 'ACTIVE',
  });

  if (session) {
    systemUserQuery = systemUserQuery.session(session);
  }

  const systemUser = await systemUserQuery;

  if (!systemUser) {
    throw new AppError({
      code: ERROR_CODES.SYSTEM_BOOTSTRAP_MISSING,
      message: 'System bootstrap user is missing',
      statusCode: 500,
    });
  }

  let systemAccountQuery = AccountModel.findOne({ userId: systemUser._id });

  if (session) {
    systemAccountQuery = systemAccountQuery.session(session);
  }

  const systemAccount = await systemAccountQuery;

  if (!systemAccount) {
    throw new AppError({
      code: ERROR_CODES.SYSTEM_BOOTSTRAP_MISSING,
      message: 'System bootstrap account is missing',
      statusCode: 500,
    });
  }

  return systemAccount;
}

async function resolveDepositTargetByAccountNumber({ accountNumber, session }) {
  const targetAccount = await findAccountWithUserByAccountNumber(accountNumber, session);

  if (!targetAccount || targetAccount.userId.role === 'SYSTEM') {
    throw new AppError({
      code: ERROR_CODES.DEPOSIT_DESTINATION_NOT_FOUND,
      message: 'Deposit destination account was not found',
      statusCode: 404,
    });
  }

  return targetAccount;
}

async function getOwnedAccountSummaryByPublicId({ publicAccountId, userId }) {
  const account = await getOwnedAccountByPublicId({
    publicAccountId,
    userId,
  });
  return mapAccountToSummary(account);
}

module.exports = {
  createPrimaryAccount,
  findAccountWithUserByAccountNumber,
  getAccountLookupForUser,
  getLedgerBalanceForAccount,
  getOwnedAccountByPublicId,
  getOwnedAccountSummaryByPublicId,
  getPrimaryAccountForUser,
  getPrimaryAccountSummaryForUser,
  getSystemAccount,
  mapAccountToSummary,
  resolveDepositTargetByAccountNumber,
  resolveTransferTargetByAccountNumber,
};
