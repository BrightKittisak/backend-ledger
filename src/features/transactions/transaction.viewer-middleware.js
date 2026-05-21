const { getPrimaryAccountForUser } = require('../accounts/account.service');

async function attachPrimaryAccount(req, res, next) {
  try {
    req.account = await getPrimaryAccountForUser(req.authUser._id);
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  attachPrimaryAccount,
};
