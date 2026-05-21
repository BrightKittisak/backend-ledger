const { createPrimaryAccount } = require('../accounts/account.service');
const { AppError } = require('../../shared/errors/app-error');
const { ERROR_CODES } = require('../../shared/errors/error-codes');
const { generatePublicId } = require('../../shared/utils/public-ids');
const { UserModel } = require('./user.model');

async function generateUniquePublicUserId(session) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const publicUserId = generatePublicId();

    const existingUser = await UserModel.findOne({ publicUserId }).session(session);

    if (!existingUser) {
      return publicUserId;
    }
  }

  throw new AppError({
    code: ERROR_CODES.INTERNAL_SERVER_ERROR,
    message: 'Unable to generate a unique user identity',
    statusCode: 500,
  });
}

async function createUserWithPrimaryAccount({
  email,
  name,
  passwordHash,
  role = 'USER',
  session,
  status = 'ACTIVE',
}) {
  const existingUser = await UserModel.findOne({ email }).session(session);

  if (existingUser) {
    throw new AppError({
      code: ERROR_CODES.USER_ALREADY_EXISTS,
      message: 'A user with this email already exists',
      statusCode: 409,
    });
  }

  const publicUserId = await generateUniquePublicUserId(session);

  const [user] = await UserModel.create(
    [
      {
        email,
        name,
        passwordHash,
        publicUserId,
        role,
        status,
      },
    ],
    { session },
  );

  const account = await createPrimaryAccount({
    session,
    userId: user._id,
  });

  return {
    account,
    user,
  };
}

module.exports = {
  createUserWithPrimaryAccount,
};
