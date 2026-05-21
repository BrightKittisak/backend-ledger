const { AccountModel } = require('../../features/accounts/account.model');
const { SessionModel } = require('../../features/auth/session.model');
const { LedgerEntryModel } = require('../../features/ledger/ledger.model');
const { UserModel } = require('../../features/users/user.model');

const models = [UserModel, AccountModel, SessionModel, LedgerEntryModel];

async function createCollectionIfNeeded(model) {
  try {
    await model.createCollection();
  } catch (error) {
    if (error.codeName !== 'NamespaceExists') {
      throw error;
    }
  }
}

async function prepareDatabase() {
  for (const model of models) {
    await createCollectionIfNeeded(model);
    await model.syncIndexes();
  }
}

module.exports = {
  prepareDatabase,
};
