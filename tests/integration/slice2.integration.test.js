const { MongoMemoryReplSet } = require('mongodb-memory-server');
const request = require('supertest');

describe('slice 2 integration', () => {
  let AccountModel;
  let createApp;
  let ensureSystemBootstrap;
  let LedgerEntryModel;
  let mongoose;
  let prepareDatabase;
  let replSet;
  let resetRuntimeState;
  let TransactionModel;
  let UserModel;
  let generateAccountNumber;

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({
      replSet: {
        count: 1,
      },
    });

    process.env.NODE_ENV = 'test';
    process.env.PORT = '3000';
    process.env.MONGO_URI = replSet.getUri();
    process.env.APP_CURRENCY = 'THB';
    process.env.ACCESS_TOKEN_SECRET = 'access-secret-access-secret-access-secret-123';
    process.env.REFRESH_TOKEN_SECRET = 'refresh-secret-refresh-secret-refresh-123';
    process.env.CORS_ORIGINS = 'http://localhost:3000';
    process.env.ACCESS_TOKEN_TTL_MINUTES = '15';
    process.env.REFRESH_TOKEN_TTL_DAYS = '7';
    process.env.RATE_LIMIT_AUTH_WINDOW_MS = '60000';
    process.env.RATE_LIMIT_AUTH_MAX = '100';
    process.env.RATE_LIMIT_LOOKUP_WINDOW_MS = '60000';
    process.env.RATE_LIMIT_LOOKUP_MAX = '100';
    process.env.RATE_LIMIT_MONEY_WINDOW_MS = '60000';
    process.env.RATE_LIMIT_MONEY_MAX = '100';
    process.env.SYSTEM_USER_EMAIL = 'system.demo@backend-ledger.local';
    process.env.SYSTEM_USER_PASSWORD = 'SystemPass123';
    process.env.SYSTEM_USER_NAME = 'Backend Ledger System';
    process.env.EMAIL_USER = '';
    process.env.CLIENT_ID = '';
    process.env.CLIENT_SECRET = '';
    process.env.EMAIL_REFRESH_TOKEN = '';

    jest.resetModules();

    mongoose = require('mongoose');
    ({ createApp } = require('../../src/app'));
    ({ prepareDatabase } = require('../../src/shared/db/prepare-database'));
    ({ resetRuntimeState } = require('../../src/shared/runtime/runtime-state'));
    ({ ensureSystemBootstrap } = require('../../src/features/system/bootstrap.service'));
    ({ AccountModel } = require('../../src/features/accounts/account.model'));
    ({ LedgerEntryModel } = require('../../src/features/ledger/ledger.model'));
    ({ TransactionModel } = require('../../src/features/transactions/transaction.model'));
    ({ UserModel } = require('../../src/features/users/user.model'));
    ({ generateAccountNumber } = require('../../src/shared/utils/account-number'));

    const { connectToDatabase } = require('../../src/shared/db/connect-to-database');
    await connectToDatabase(process.env.MONGO_URI);
  });

  beforeEach(async () => {
    if (mongoose.connection.db) {
      await mongoose.connection.db.dropDatabase();
    }

    await prepareDatabase();
    resetRuntimeState();
    await ensureSystemBootstrap();
  });

  afterAll(async () => {
    await mongoose.disconnect();

    if (replSet) {
      await replSet.stop();
    }
  });

  async function registerUser(application, { email, name, password }) {
    const response = await request(application).post('/api/v1/auth/register').send({
      email,
      name,
      password,
    });

    return {
      accessToken: response.body.data.accessToken,
      account: response.body.data.primaryAccount,
      response,
    };
  }

  async function fundAccountForTest({ amountMinor, targetEmail }) {
    const systemUser = await UserModel.findOne({ email: process.env.SYSTEM_USER_EMAIL });
    const targetUser = await UserModel.findOne({ email: targetEmail });
    const systemAccount = await AccountModel.findOne({ userId: systemUser._id });
    const targetAccount = await AccountModel.findOne({ userId: targetUser._id });

    await AccountModel.updateOne(
      { _id: systemAccount._id },
      {
        $inc: {
          availableBalanceMinor: -amountMinor,
        },
      },
    );
    await AccountModel.updateOne(
      { _id: targetAccount._id },
      {
        $inc: {
          availableBalanceMinor: amountMinor,
        },
      },
    );

    const updatedSystemAccount = await AccountModel.findById(systemAccount._id);
    const updatedTargetAccount = await AccountModel.findById(targetAccount._id);

    const transaction = await TransactionModel.create({
      amountMinor,
      currency: 'THB',
      fromAccountBalanceAfterMinor: updatedSystemAccount.availableBalanceMinor,
      fromAccountId: systemAccount._id,
      fromAccountNumberSnapshot: systemAccount.accountNumber,
      fromMaskedNameSnapshot: 'B******d L*****r S****m',
      initiatedByRole: 'SYSTEM',
      initiatedByUserId: systemUser._id,
      metadata: {
        reason: 'TEST_FUNDING',
      },
      publicTransactionId: `test-funding-${Date.now()}-${Math.random()}`,
      toAccountBalanceAfterMinor: updatedTargetAccount.availableBalanceMinor,
      toAccountId: targetAccount._id,
      toAccountNumberSnapshot: targetAccount.accountNumber,
      toMaskedNameSnapshot: 'T***t',
      type: 'DEPOSIT',
    });

    await LedgerEntryModel.create([
      {
        accountId: systemAccount._id,
        amountMinor,
        direction: 'DEBIT',
        transactionId: transaction._id,
      },
      {
        accountId: targetAccount._id,
        amountMinor,
        direction: 'CREDIT',
        transactionId: transaction._id,
      },
    ]);
  }

  test('account lookup handles valid, own, invalid, inactive, and missing recipients', async () => {
    const application = createApp();
    const alice = await registerUser(application, {
      email: 'alice.lookup@backend-ledger.local',
      name: 'Alice Lookup',
      password: 'Password123',
    });
    const bob = await registerUser(application, {
      email: 'bob.lookup@backend-ledger.local',
      name: 'Bob Lookup',
      password: 'Password123',
    });

    const validLookupResponse = await request(application)
      .get(`/api/v1/accounts/lookup?accountNumber=${bob.account.accountNumber}`)
      .set('Authorization', `Bearer ${alice.accessToken}`);

    expect(validLookupResponse.statusCode).toBe(200);
    expect(validLookupResponse.body.data.canTransfer).toBe(true);
    expect(validLookupResponse.body.data.isOwnAccount).toBe(false);
    expect(validLookupResponse.body.data.reason.code).toBe('OK');
    expect(validLookupResponse.body.data.maskedAccountName).toBeTruthy();

    const ownLookupResponse = await request(application)
      .get(`/api/v1/accounts/lookup?accountNumber=${alice.account.accountNumber}`)
      .set('Authorization', `Bearer ${alice.accessToken}`);

    expect(ownLookupResponse.statusCode).toBe(200);
    expect(ownLookupResponse.body.data.canTransfer).toBe(false);
    expect(ownLookupResponse.body.data.isOwnAccount).toBe(true);
    expect(ownLookupResponse.body.data.reason.code).toBe('OWN_ACCOUNT');

    await AccountModel.updateOne(
      { publicAccountId: bob.account.publicAccountId },
      {
        $set: {
          status: 'FROZEN',
        },
      },
    );

    const inactiveLookupResponse = await request(application)
      .get(`/api/v1/accounts/lookup?accountNumber=${bob.account.accountNumber}`)
      .set('Authorization', `Bearer ${alice.accessToken}`);

    expect(inactiveLookupResponse.statusCode).toBe(200);
    expect(inactiveLookupResponse.body.data.canTransfer).toBe(false);
    expect(inactiveLookupResponse.body.data.reason.code).toBe('ACCOUNT_NOT_ACTIVE');

    const missingAccountNumber = generateAccountNumber();

    const missingLookupResponse = await request(application)
      .get(`/api/v1/accounts/lookup?accountNumber=${missingAccountNumber}`)
      .set('Authorization', `Bearer ${alice.accessToken}`);

    expect(missingLookupResponse.statusCode).toBe(200);
    expect(missingLookupResponse.body.data.canTransfer).toBe(false);
    expect(missingLookupResponse.body.data.reason.code).toBe('NOT_FOUND');

    const invalidLookupResponse = await request(application)
      .get('/api/v1/accounts/lookup?accountNumber=123')
      .set('Authorization', `Bearer ${alice.accessToken}`);

    expect(invalidLookupResponse.statusCode).toBe(422);
  });

  test('transfer supports success, replay, and idempotency conflict semantics', async () => {
    const application = createApp();
    const alice = await registerUser(application, {
      email: 'alice.transfer@backend-ledger.local',
      name: 'Alice Transfer',
      password: 'Password123',
    });
    const bob = await registerUser(application, {
      email: 'bob.transfer@backend-ledger.local',
      name: 'Bob Transfer',
      password: 'Password123',
    });

    await fundAccountForTest({
      amountMinor: 5000,
      targetEmail: 'alice.transfer@backend-ledger.local',
    });

    const transferPayload = {
      amountMinor: 1200,
      metadata: {
        note: 'Lunch share',
      },
      toAccountNumber: bob.account.accountNumber,
    };

    const firstTransferResponse = await request(application)
      .post('/api/v1/transfers')
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .set('Idempotency-Key', 'transfer-key-1')
      .send(transferPayload);

    expect(firstTransferResponse.statusCode).toBe(201);
    expect(firstTransferResponse.body.meta.idempotency.replayed).toBe(false);
    expect(firstTransferResponse.body.data.direction).toBe('OUT');
    expect(firstTransferResponse.body.data.balanceAfterMinor).toBe(3800);
    expect(firstTransferResponse.body.data.counterparty.accountNumber).toBe(
      bob.account.accountNumber,
    );

    const replayTransferResponse = await request(application)
      .post('/api/v1/transfers')
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .set('Idempotency-Key', 'transfer-key-1')
      .send(transferPayload);

    expect(replayTransferResponse.statusCode).toBe(200);
    expect(replayTransferResponse.body.meta.idempotency.replayed).toBe(true);
    expect(replayTransferResponse.body.data.publicTransactionId).toBe(
      firstTransferResponse.body.data.publicTransactionId,
    );

    const conflictTransferResponse = await request(application)
      .post('/api/v1/transfers')
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .set('Idempotency-Key', 'transfer-key-1')
      .send({
        ...transferPayload,
        amountMinor: 1300,
      });

    expect(conflictTransferResponse.statusCode).toBe(409);
    expect(conflictTransferResponse.body.error.code).toBe('IDEMPOTENCY_CONFLICT');

    const aliceMeResponse = await request(application)
      .get('/api/v1/accounts/me')
      .set('Authorization', `Bearer ${alice.accessToken}`);
    const bobLoginResponse = await request(application).post('/api/v1/auth/login').send({
      email: 'bob.transfer@backend-ledger.local',
      password: 'Password123',
    });
    const bobMeResponse = await request(application)
      .get('/api/v1/accounts/me')
      .set('Authorization', `Bearer ${bobLoginResponse.body.data.accessToken}`);

    expect(aliceMeResponse.body.data.currentBalanceMinor).toBe(3800);
    expect(bobMeResponse.body.data.currentBalanceMinor).toBe(1200);
  });

  test('concurrent transfers do not overspend the source account', async () => {
    const application = createApp();
    const alice = await registerUser(application, {
      email: 'alice.concurrent@backend-ledger.local',
      name: 'Alice Concurrent',
      password: 'Password123',
    });
    const bob = await registerUser(application, {
      email: 'bob.concurrent@backend-ledger.local',
      name: 'Bob Concurrent',
      password: 'Password123',
    });
    const charlie = await registerUser(application, {
      email: 'charlie.concurrent@backend-ledger.local',
      name: 'Charlie Concurrent',
      password: 'Password123',
    });

    await fundAccountForTest({
      amountMinor: 1000,
      targetEmail: 'alice.concurrent@backend-ledger.local',
    });

    const [firstResponse, secondResponse] = await Promise.all([
      request(application)
        .post('/api/v1/transfers')
        .set('Authorization', `Bearer ${alice.accessToken}`)
        .set('Idempotency-Key', 'concurrent-key-1')
        .send({
          amountMinor: 700,
          metadata: {
            note: 'Parallel 1',
          },
          toAccountNumber: bob.account.accountNumber,
        }),
      request(application)
        .post('/api/v1/transfers')
        .set('Authorization', `Bearer ${alice.accessToken}`)
        .set('Idempotency-Key', 'concurrent-key-2')
        .send({
          amountMinor: 700,
          metadata: {
            note: 'Parallel 2',
          },
          toAccountNumber: charlie.account.accountNumber,
        }),
    ]);

    const statusCodes = [firstResponse.statusCode, secondResponse.statusCode].sort();
    expect(statusCodes).toEqual([201, 409]);

    const aliceMeResponse = await request(application)
      .get('/api/v1/accounts/me')
      .set('Authorization', `Bearer ${alice.accessToken}`);

    expect(aliceMeResponse.statusCode).toBe(200);
    expect(aliceMeResponse.body.data.currentBalanceMinor).toBe(300);

    const successfulTransfers = await TransactionModel.countDocuments({ type: 'TRANSFER' });
    expect(successfulTransfers).toBe(1);
  });
});
