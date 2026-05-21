const { sendSuccess } = require('../../shared/http/responses');
const { createWithdrawal } = require('./withdrawal.service');

async function createWithdrawalController(req, res) {
  const result = await createWithdrawal({
    amountMinor: req.validated.body.amountMinor,
    idempotencyKey: req.validated.headers['idempotency-key'],
    initiatedByUser: req.authUser,
    metadata: req.validated.body.metadata,
  });

  return sendSuccess(res, {
    data: result.transaction,
    meta: {
      idempotency: {
        replayed: result.replayed,
      },
    },
    statusCode: result.statusCode,
  });
}

module.exports = {
  createWithdrawalController,
};
