const { getOwnedAccountByPublicId } = require('../accounts/account.service');

async function attachOwnedAccountByPublicId(req, res, next) {
  try {
    req.account = await getOwnedAccountByPublicId({
      publicAccountId: req.validated.params.publicAccountId,
      userId: req.authUser._id,
    });
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  attachOwnedAccountByPublicId,
};
