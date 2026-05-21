const { MongoMemoryReplSet } = require('mongodb-memory-server');
const request = require('supertest');

describe('slice 3 integration', () => {
  let AccountModel;
  let createApp;
  let ensureSystemBootstrap;
  let mongoose;
  let prepareDatabase;
  let replSet;
  let resetRuntimeState;

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

  async function loginUser(application, { email, password }) {
    const response = await request(application).post('/api/v1/auth/login').send({
      email,
      password,
    });

    return {
      accessToken: response.body.data.accessToken,
      response,
    };
  }

  async function depositAsSystem({
    amountMinor,
    application,
    idempotencyKey,
    reason = 'TEST_DEPOSIT',
    toAccountNumber,
  }) {
    const systemLogin = await loginUser(application, {
      email: process.env.SYSTEM_USER_EMAIL,
      password: process.env.SYSTEM_USER_PASSWORD,
    });

    return request(application)
      .post('/api/v1/deposits')
      .set('Authorization', `Bearer ${systemLogin.accessToken}`)
      .set('Idempotency-Key', idempotencyKey)
      .send({
        amountMinor,
        metadata: {
          reason,
        },
        toAccountNumber,
      });
  }

  test('deposit requires SYSTEM role and supports replay and conflict semantics', async () => {
    const application = createApp();
    const alice = await registerUser(application, {
      email: 'alice.deposit@backend-ledger.local',
      name: 'Alice Deposit',
      password: 'Password123',
    });

    const forbiddenDepositResponse = await request(application)
      .post('/api/v1/deposits')
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .set('Idempotency-Key', 'deposit-forbidden-1')
      .send({
        amountMinor: 5000,
        metadata: {
          reason: 'Should fail',
        },
        toAccountNumber: alice.account.accountNumber,
      });

    expect(forbiddenDepositResponse.statusCode).toBe(403);
    expect(forbiddenDepositResponse.body.error.code).toBe('FORBIDDEN');

    const firstDepositResponse = await depositAsSystem({
      amountMinor: 5000,
      application,
      idempotencyKey: 'deposit-key-1',
      reason: 'Initial funding',
      toAccountNumber: alice.account.accountNumber,
    });

    expect(firstDepositResponse.statusCode).toBe(201);
    expect(firstDepositResponse.body.meta.idempotency.replayed).toBe(false);
    expect(firstDepositResponse.body.data.direction).toBe('OUT');
    expect(firstDepositResponse.body.data.counterparty.accountNumber).toBe(
      alice.account.accountNumber,
    );
    expect(firstDepositResponse.body.data.metadata.reason).toBe('Initial funding');

    const replayDepositResponse = await depositAsSystem({
      amountMinor: 5000,
      application,
      idempotencyKey: 'deposit-key-1',
      reason: 'Initial funding',
      toAccountNumber: alice.account.accountNumber,
    });

    expect(replayDepositResponse.statusCode).toBe(200);
    expect(replayDepositResponse.body.meta.idempotency.replayed).toBe(true);
    expect(replayDepositResponse.body.data.publicTransactionId).toBe(
      firstDepositResponse.body.data.publicTransactionId,
    );

    const conflictDepositResponse = await depositAsSystem({
      amountMinor: 5100,
      application,
      idempotencyKey: 'deposit-key-1',
      reason: 'Different amount',
      toAccountNumber: alice.account.accountNumber,
    });

    expect(conflictDepositResponse.statusCode).toBe(409);
    expect(conflictDepositResponse.body.error.code).toBe('IDEMPOTENCY_CONFLICT');

    const aliceMeResponse = await request(application)
      .get('/api/v1/accounts/me')
      .set('Authorization', `Bearer ${alice.accessToken}`);

    expect(aliceMeResponse.body.data.currentBalanceMinor).toBe(5000);
  });

  test('deposit can credit a closed account', async () => {
    const application = createApp();
    const bob = await registerUser(application, {
      email: 'bob.closed@backend-ledger.local',
      name: 'Bob Closed',
      password: 'Password123',
    });

    await AccountModel.updateOne(
      { publicAccountId: bob.account.publicAccountId },
      {
        $set: {
          status: 'CLOSED',
        },
      },
    );

    const depositResponse = await depositAsSystem({
      amountMinor: 2000,
      application,
      idempotencyKey: 'deposit-key-closed',
      reason: 'Closed account adjustment',
      toAccountNumber: bob.account.accountNumber,
    });

    expect(depositResponse.statusCode).toBe(201);

    const bobMeResponse = await request(application)
      .get('/api/v1/accounts/me')
      .set('Authorization', `Bearer ${bob.accessToken}`);

    expect(bobMeResponse.body.data.currentBalanceMinor).toBe(2000);
    expect(bobMeResponse.body.data.status).toBe('CLOSED');
  });

  test('withdrawal supports success, replay, and conflict semantics', async () => {
    const application = createApp();
    const alice = await registerUser(application, {
      email: 'alice.withdraw@backend-ledger.local',
      name: 'Alice Withdraw',
      password: 'Password123',
    });

    await depositAsSystem({
      amountMinor: 4000,
      application,
      idempotencyKey: 'funding-key-withdraw',
      reason: 'Funding for withdraw',
      toAccountNumber: alice.account.accountNumber,
    });

    const withdrawalPayload = {
      amountMinor: 1500,
      metadata: {
        bankAccountName: 'Alice Withdraw',
        bankAccountNumber: '1234567890',
        bankName: 'KBank',
        note: 'Cash out',
      },
    };

    const firstWithdrawalResponse = await request(application)
      .post('/api/v1/withdrawals')
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .set('Idempotency-Key', 'withdraw-key-1')
      .send(withdrawalPayload);

    expect(firstWithdrawalResponse.statusCode).toBe(201);
    expect(firstWithdrawalResponse.body.meta.idempotency.replayed).toBe(false);
    expect(firstWithdrawalResponse.body.data.direction).toBe('OUT');
    expect(firstWithdrawalResponse.body.data.balanceAfterMinor).toBe(2500);
    expect(firstWithdrawalResponse.body.data.counterparty.displayName).toBe(
      'System Withdrawal',
    );
    expect(firstWithdrawalResponse.body.data.metadata.bankAccountNumber).toMatch(/7890$/);
    expect(firstWithdrawalResponse.body.data.metadata.bankAccountNumber).not.toBe(
      withdrawalPayload.metadata.bankAccountNumber,
    );

    const replayWithdrawalResponse = await request(application)
      .post('/api/v1/withdrawals')
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .set('Idempotency-Key', 'withdraw-key-1')
      .send(withdrawalPayload);

    expect(replayWithdrawalResponse.statusCode).toBe(200);
    expect(replayWithdrawalResponse.body.meta.idempotency.replayed).toBe(true);
    expect(replayWithdrawalResponse.body.data.publicTransactionId).toBe(
      firstWithdrawalResponse.body.data.publicTransactionId,
    );

    const conflictWithdrawalResponse = await request(application)
      .post('/api/v1/withdrawals')
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .set('Idempotency-Key', 'withdraw-key-1')
      .send({
        ...withdrawalPayload,
        amountMinor: 1600,
      });

    expect(conflictWithdrawalResponse.statusCode).toBe(409);
    expect(conflictWithdrawalResponse.body.error.code).toBe('IDEMPOTENCY_CONFLICT');

    const aliceMeResponse = await request(application)
      .get('/api/v1/accounts/me')
      .set('Authorization', `Bearer ${alice.accessToken}`);

    expect(aliceMeResponse.body.data.currentBalanceMinor).toBe(2500);
  });

  test('withdrawal rejects insufficient funds and inactive accounts', async () => {
    const application = createApp();
    const charlie = await registerUser(application, {
      email: 'charlie.withdraw@backend-ledger.local',
      name: 'Charlie Withdraw',
      password: 'Password123',
    });

    const insufficientFundsResponse = await request(application)
      .post('/api/v1/withdrawals')
      .set('Authorization', `Bearer ${charlie.accessToken}`)
      .set('Idempotency-Key', 'withdraw-key-insufficient')
      .send({
        amountMinor: 100,
        metadata: {
          bankAccountName: 'Charlie Withdraw',
          bankAccountNumber: '9876543210',
          bankName: 'SCB',
        },
      });

    expect(insufficientFundsResponse.statusCode).toBe(409);
    expect(insufficientFundsResponse.body.error.code).toBe('INSUFFICIENT_FUNDS');

    await depositAsSystem({
      amountMinor: 500,
      application,
      idempotencyKey: 'funding-key-frozen',
      reason: 'Funding before freeze',
      toAccountNumber: charlie.account.accountNumber,
    });

    await AccountModel.updateOne(
      { publicAccountId: charlie.account.publicAccountId },
      {
        $set: {
          status: 'FROZEN',
        },
      },
    );

    const frozenAccountResponse = await request(application)
      .post('/api/v1/withdrawals')
      .set('Authorization', `Bearer ${charlie.accessToken}`)
      .set('Idempotency-Key', 'withdraw-key-frozen')
      .send({
        amountMinor: 100,
        metadata: {
          bankAccountName: 'Charlie Withdraw',
          bankAccountNumber: '9876543210',
          bankName: 'SCB',
        },
      });

    expect(frozenAccountResponse.statusCode).toBe(409);
    expect(frozenAccountResponse.body.error.code).toBe('ACCOUNT_NOT_ACTIVE');
  });
});
