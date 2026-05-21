const { sendSuccess } = require('../../shared/http/responses');
const { createTransfer } = require('./transfer.service');

async function createTransferController(req, res) {
  const result = await createTransfer({
    amountMinor: req.validated.body.amountMinor,
    idempotencyKey: req.validated.headers['idempotency-key'],
    initiatedByUser: req.authUser,
    metadata: req.validated.body.metadata,
    toAccountNumber: req.validated.body.toAccountNumber,
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
  createTransferController,
};
