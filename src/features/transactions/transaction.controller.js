const { sendSuccess } = require('../../shared/http/responses');
const {
  getTransactionHistoryForAccount,
  getTransactionViewByPublicIdForViewer,
} = require('./transaction.service');

async function getAccountTransactionHistoryController(req, res) {
  const result = await getTransactionHistoryForAccount({
    accountId: req.account._id,
    filters: req.validated.query,
  });

  return sendSuccess(res, {
    data: result.items,
    meta: {
      limit: result.limit,
      page: result.page,
      totalItems: result.totalItems,
      totalPages: result.totalPages,
    },
  });
}

async function getTransactionDetailController(req, res) {
  const transactionView = await getTransactionViewByPublicIdForViewer({
    publicTransactionId: req.validated.params.publicTransactionId,
    viewerAccountId: req.account._id,
  });

  return sendSuccess(res, {
    data: transactionView,
  });
}

module.exports = {
  getAccountTransactionHistoryController,
  getTransactionDetailController,
};
