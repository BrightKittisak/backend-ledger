const mongoose = require('mongoose');

const { getPrimaryAccountSummaryForUser } = require('../accounts/account.service');
const { sendWelcomeEmail } = require('../notifications/email.service');
const { UserModel } = require('../users/user.model');
const { createUserWithPrimaryAccount } = require('../users/user-account.service');
const { config } = require('../../shared/config/env');
const { runInTransaction } = require('../../shared/db/mongoose-session');
const { AppError } = require('../../shared/errors/app-error');
const { ERROR_CODES } = require('../../shared/errors/error-codes');
const { hashPassword, verifyPassword } = require('../../shared/utils/passwords');
const { hashValue, randomToken } = require('../../shared/utils/security');
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} = require('../../shared/utils/tokens');
const { SessionModel } = require('./session.model');

function buildSessionExpiryDate() {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + config.refreshTokenTtlDays);
  return expiresAt;
}

async function revokeAllSessionsForUser(userId, session) {
  return SessionModel.updateMany(
    {
      revokedAt: null,
      userId,
    },
    {
      $set: {
        revokedAt: new Date(),
      },
    },
    { session },
  );
}

async function createSessionForUser({ session, userId }) {
  const expiresAt = buildSessionExpiryDate();
  const sessionId = new mongoose.Types.ObjectId();
  const csrfToken = randomToken();
  const refreshToken = signRefreshToken({
    sessionId: sessionId.toString(),
    userId: userId.toString(),
  });

  await SessionModel.create(
    [
      {
        _id: sessionId,
        csrfTokenHash: hashValue(csrfToken),
        expiresAt,
        refreshTokenHash: hashValue(refreshToken),
        userId,
      },
    ],
    { session },
  );

  return {
    csrfToken,
    refreshToken,
  };
}

function buildAuthPayload({ accountSummary, csrfToken, user, withUserProfile = true }) {
  const payload = {
    accessToken: signAccessToken(user._id.toString()),
    csrfToken,
    primaryAccount: accountSummary,
  };

  if (withUserProfile) {
    payload.user = {
      email: user.email,
      name: user.name,
      publicUserId: user.publicUserId,
      role: user.role,
    };
  }

  return payload;
}

async function registerUser({ email, name, password }) {
  const passwordHash = await hashPassword(password);

  const transactionResult = await runInTransaction(async (session) => {
    const { account, user } = await createUserWithPrimaryAccount({
      email,
      name,
      passwordHash,
      session,
    });

    const sessionTokens = await createSessionForUser({
      session,
      userId: user._id,
    });

    return {
      account,
      sessionTokens,
      user,
    };
  });

  const accountSummary = await getPrimaryAccountSummaryForUser(transactionResult.user._id);

  await sendWelcomeEmail({
    email: transactionResult.user.email,
    name: transactionResult.user.name,
  });

  return {
    authPayload: buildAuthPayload({
      accountSummary,
      csrfToken: transactionResult.sessionTokens.csrfToken,
      user: transactionResult.user,
    }),
    refreshToken: transactionResult.sessionTokens.refreshToken,
  };
}

async function loginUser({ email, password }) {
  const user = await UserModel.findOne({ email }).select('+passwordHash');

  if (!user) {
    throw new AppError({
      code: ERROR_CODES.AUTH_INVALID_CREDENTIALS,
      message: 'Email or password is invalid',
      statusCode: 401,
    });
  }

  if (user.status !== 'ACTIVE') {
    throw new AppError({
      code: ERROR_CODES.USER_SUSPENDED,
      message: 'User account is suspended',
      statusCode: 403,
    });
  }

  const passwordIsValid = await verifyPassword(password, user.passwordHash);

  if (!passwordIsValid) {
    throw new AppError({
      code: ERROR_CODES.AUTH_INVALID_CREDENTIALS,
      message: 'Email or password is invalid',
      statusCode: 401,
    });
  }

  const sessionTokens = await runInTransaction(async (session) => {
    await revokeAllSessionsForUser(user._id, session);
    return createSessionForUser({
      session,
      userId: user._id,
    });
  });

  const accountSummary = await getPrimaryAccountSummaryForUser(user._id);

  return {
    authPayload: buildAuthPayload({
      accountSummary,
      csrfToken: sessionTokens.csrfToken,
      user,
    }),
    refreshToken: sessionTokens.refreshToken,
  };
}

async function refreshUserSession({ csrfToken, refreshToken }) {
  if (!refreshToken) {
    throw new AppError({
      code: ERROR_CODES.AUTH_REFRESH_REQUIRED,
      message: 'Refresh session is required',
      statusCode: 401,
    });
  }

  let payload;

  try {
    payload = verifyRefreshToken(refreshToken);
  } catch (error) {
    throw new AppError({
      code: ERROR_CODES.INVALID_REFRESH_TOKEN,
      message: 'Refresh token is invalid',
      statusCode: 401,
    });
  }

  const user = await UserModel.findById(payload.sub);

  if (!user) {
    throw new AppError({
      code: ERROR_CODES.INVALID_REFRESH_TOKEN,
      message: 'Refresh token is invalid',
      statusCode: 401,
    });
  }

  if (user.status !== 'ACTIVE') {
    await runInTransaction(async (session) => revokeAllSessionsForUser(user._id, session));
    throw new AppError({
      code: ERROR_CODES.USER_SUSPENDED,
      message: 'User account is suspended',
      statusCode: 403,
    });
  }

  const sessionDocument = await SessionModel.findById(payload.sid).select(
    '+refreshTokenHash +csrfTokenHash',
  );

  const refreshTokenHash = hashValue(refreshToken);
  const csrfTokenHash = hashValue(csrfToken);

  if (
    !sessionDocument ||
    sessionDocument.userId.toString() !== user._id.toString() ||
    sessionDocument.revokedAt ||
    sessionDocument.refreshTokenHash !== refreshTokenHash ||
    sessionDocument.csrfTokenHash !== csrfTokenHash
  ) {
    await runInTransaction(async (session) => revokeAllSessionsForUser(user._id, session));
    throw new AppError({
      code: ERROR_CODES.INVALID_REFRESH_TOKEN,
      message: 'Refresh token is invalid',
      statusCode: 401,
    });
  }

  const newSessionTokens = await runInTransaction(async (session) => {
    await SessionModel.updateOne(
      { _id: sessionDocument._id },
      {
        $set: {
          revokedAt: new Date(),
          rotatedAt: new Date(),
        },
      },
      { session },
    );

    return createSessionForUser({
      session,
      userId: user._id,
    });
  });

  const accountSummary = await getPrimaryAccountSummaryForUser(user._id);

  return {
    authPayload: {
      accessToken: signAccessToken(user._id.toString()),
      csrfToken: newSessionTokens.csrfToken,
      primaryAccount: accountSummary,
    },
    refreshToken: newSessionTokens.refreshToken,
  };
}

async function logoutUser({ csrfToken, refreshToken }) {
  if (!refreshToken) {
    return;
  }

  let payload;

  try {
    payload = verifyRefreshToken(refreshToken);
  } catch (error) {
    return;
  }

  const sessionDocument = await SessionModel.findById(payload.sid).select(
    '+refreshTokenHash +csrfTokenHash',
  );

  if (!sessionDocument || sessionDocument.revokedAt) {
    return;
  }

  if (
    sessionDocument.refreshTokenHash !== hashValue(refreshToken) ||
    sessionDocument.csrfTokenHash !== hashValue(csrfToken)
  ) {
    return;
  }

  await SessionModel.updateOne(
    { _id: sessionDocument._id },
    {
      $set: {
        revokedAt: new Date(),
      },
    },
  );
}

async function getCurrentAuthState(user) {
  const primaryAccount = await getPrimaryAccountSummaryForUser(user._id);

  return {
    primaryAccount,
    user: {
      email: user.email,
      name: user.name,
      publicUserId: user.publicUserId,
      role: user.role,
    },
  };
}

async function changePassword({ currentPassword, newPassword, user }) {
  const userWithPassword = await UserModel.findById(user._id).select('+passwordHash');

  const currentPasswordMatches = await verifyPassword(
    currentPassword,
    userWithPassword.passwordHash,
  );

  if (!currentPasswordMatches) {
    throw new AppError({
      code: ERROR_CODES.AUTH_INVALID_CREDENTIALS,
      message: 'Current password is invalid',
      statusCode: 401,
    });
  }

  const newPasswordHash = await hashPassword(newPassword);

  await runInTransaction(async (session) => {
    await UserModel.updateOne(
      { _id: user._id },
      {
        $set: {
          passwordHash: newPasswordHash,
        },
      },
      { session },
    );

    await revokeAllSessionsForUser(user._id, session);
  });
}

module.exports = {
  changePassword,
  getCurrentAuthState,
  loginUser,
  logoutUser,
  refreshUserSession,
  registerUser,
  revokeAllSessionsForUser,
};
