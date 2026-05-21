const { sendSuccess } = require('../../shared/http/responses');
const {
  getOwnedAccountSummaryByPublicId,
  getPrimaryAccountSummaryForUser,
} = require('./account.service');

async function getMyPrimaryAccountController(req, res) {
  const accountSummary = await getPrimaryAccountSummaryForUser(req.authUser._id);

  return sendSuccess(res, {
    data: accountSummary,
  });
}

async function getOwnedAccountController(req, res) {
  const accountSummary = await getOwnedAccountSummaryByPublicId({
    publicAccountId: req.validated.params.publicAccountId,
    userId: req.authUser._id,
  });

  return sendSuccess(res, {
    data: accountSummary,
  });
}

module.exports = {
  getMyPrimaryAccountController,
  getOwnedAccountController,
};
