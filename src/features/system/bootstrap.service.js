const { AccountModel } = require('../accounts/account.model');
const { UserModel } = require('../users/user.model');
const { config } = require('../../shared/config/env');
const { runInTransaction } = require('../../shared/db/mongoose-session');
const { AppError } = require('../../shared/errors/app-error');
const { ERROR_CODES } = require('../../shared/errors/error-codes');
const { markBootstrapReady } = require('../../shared/runtime/runtime-state');
const { hashPassword } = require('../../shared/utils/passwords');
const { createUserWithPrimaryAccount } = require('../users/user-account.service');

async function ensureSystemBootstrap() {
  const existingUser = await UserModel.findOne({
    email: config.systemUser.email,
  });

  if (existingUser) {
    const existingAccount = await AccountModel.findOne({ userId: existingUser._id });

    if (existingAccount) {
      return {
        account: existingAccount,
        created: false,
        user: existingUser,
      };
    }
  }

  return runInTransaction(async (session) => {
    const refreshedUser = await UserModel.findOne({
      email: config.systemUser.email,
    }).session(session);

    if (refreshedUser) {
      const refreshedAccount = await AccountModel.findOne({
        userId: refreshedUser._id,
      }).session(session);

      if (refreshedAccount) {
        return {
          account: refreshedAccount,
          created: false,
          user: refreshedUser,
        };
      }
    }

    const passwordHash = await hashPassword(config.systemUser.password);

    const createdSystemUser = await createUserWithPrimaryAccount({
      email: config.systemUser.email,
      name: config.systemUser.name,
      passwordHash,
      role: 'SYSTEM',
      session,
    });

    return {
      ...createdSystemUser,
      created: true,
    };
  });
}

async function assertBootstrapReady() {
  const systemUser = await UserModel.findOne({
    email: config.systemUser.email,
    role: 'SYSTEM',
    status: 'ACTIVE',
  });

  if (!systemUser) {
    throw new AppError({
      code: ERROR_CODES.SYSTEM_BOOTSTRAP_MISSING,
      message: 'System bootstrap user is missing',
      statusCode: 500,
    });
  }

  const systemAccount = await AccountModel.findOne({
    userId: systemUser._id,
  });

  if (!systemAccount) {
    throw new AppError({
      code: ERROR_CODES.SYSTEM_BOOTSTRAP_MISSING,
      message: 'System bootstrap account is missing',
      statusCode: 500,
    });
  }

  markBootstrapReady();

  return {
    systemAccount,
    systemUser,
  };
}

module.exports = {
  assertBootstrapReady,
  ensureSystemBootstrap,
};
