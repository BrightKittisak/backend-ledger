const { MongoMemoryReplSet } = require('mongodb-memory-server');
const request = require('supertest');

describe('slice 4 integration', () => {
  let createApp;
  let mongoose;
  let prepareDatabase;
  let replSet;
  let resetRuntimeState;
  let ensureSystemBootstrap;

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
    reason,
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

  test('account transaction history supports pagination and type/date filters', async () => {
    const application = createApp();
    const alice = await registerUser(application, {
      email: 'alice.history@backend-ledger.local',
      name: 'Alice History',
      password: 'Password123',
    });
    const bob = await registerUser(application, {
      email: 'bob.history@backend-ledger.local',
      name: 'Bob History',
      password: 'Password123',
    });

    const depositResponse = await depositAsSystem({
      amountMinor: 5000,
      application,
      idempotencyKey: 'history-deposit-1',
      reason: 'Initial history funding',
      toAccountNumber: alice.account.accountNumber,
    });

    const transferResponse = await request(application)
      .post('/api/v1/transfers')
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .set('Idempotency-Key', 'history-transfer-1')
      .send({
        amountMinor: 1200,
        metadata: {
          note: 'History transfer',
        },
        toAccountNumber: bob.account.accountNumber,
      });

    await request(application)
      .post('/api/v1/withdrawals')
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .set('Idempotency-Key', 'history-withdraw-1')
      .send({
        amountMinor: 700,
        metadata: {
          bankAccountName: 'Alice History',
          bankAccountNumber: '1234567890',
          bankName: 'KBank',
          note: 'History withdrawal',
        },
      });

    const historyResponse = await request(application)
      .get(`/api/v1/accounts/${alice.account.publicAccountId}/transactions?page=1&limit=2`)
      .set('Authorization', `Bearer ${alice.accessToken}`);

    expect(historyResponse.statusCode).toBe(200);
    expect(historyResponse.body.meta.page).toBe(1);
    expect(historyResponse.body.meta.limit).toBe(2);
    expect(historyResponse.body.meta.totalItems).toBe(3);
    expect(historyResponse.body.meta.totalPages).toBe(2);
    expect(historyResponse.body.data).toHaveLength(2);
    expect(historyResponse.body.data[0].type).toBe('WITHDRAW');
    expect(historyResponse.body.data[1].type).toBe('TRANSFER');
    expect(historyResponse.body.data[0].balanceAfterMinor).toBe(3100);

    const transferOnlyResponse = await request(application)
      .get(`/api/v1/accounts/${alice.account.publicAccountId}/transactions?type=TRANSFER`)
      .set('Authorization', `Bearer ${alice.accessToken}`);

    expect(transferOnlyResponse.statusCode).toBe(200);
    expect(transferOnlyResponse.body.meta.totalItems).toBe(1);
    expect(transferOnlyResponse.body.data[0].publicTransactionId).toBe(
      transferResponse.body.data.publicTransactionId,
    );

    const fromDateResponse = await request(application)
      .get(
        `/api/v1/accounts/${alice.account.publicAccountId}/transactions?from=${encodeURIComponent(
          transferResponse.body.data.createdAt,
        )}`,
      )
      .set('Authorization', `Bearer ${alice.accessToken}`);

    expect(fromDateResponse.statusCode).toBe(200);
    expect(fromDateResponse.body.meta.totalItems).toBe(2);

    const toDateResponse = await request(application)
      .get(
        `/api/v1/accounts/${alice.account.publicAccountId}/transactions?to=${encodeURIComponent(
          transferResponse.body.data.createdAt,
        )}`,
      )
      .set('Authorization', `Bearer ${alice.accessToken}`);

    expect(toDateResponse.statusCode).toBe(200);
    expect(toDateResponse.body.meta.totalItems).toBe(2);
    expect(
      toDateResponse.body.data.some(
        (item) => item.publicTransactionId === depositResponse.body.data.publicTransactionId,
      ),
    ).toBe(true);
  });

  test('transaction detail is returned in the viewer perspective and hidden from unrelated users', async () => {
    const application = createApp();
    const alice = await registerUser(application, {
      email: 'alice.detail@backend-ledger.local',
      name: 'Alice Detail',
      password: 'Password123',
    });
    const bob = await registerUser(application, {
      email: 'bob.detail@backend-ledger.local',
      name: 'Bob Detail',
      password: 'Password123',
    });
    const charlie = await registerUser(application, {
      email: 'charlie.detail@backend-ledger.local',
      name: 'Charlie Detail',
      password: 'Password123',
    });

    await depositAsSystem({
      amountMinor: 3000,
      application,
      idempotencyKey: 'detail-deposit-1',
      reason: 'Detail funding',
      toAccountNumber: alice.account.accountNumber,
    });

    const transferResponse = await request(application)
      .post('/api/v1/transfers')
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .set('Idempotency-Key', 'detail-transfer-1')
      .send({
        amountMinor: 1000,
        metadata: {
          note: 'Detail transfer',
        },
        toAccountNumber: bob.account.accountNumber,
      });

    const aliceDetailResponse = await request(application)
      .get(`/api/v1/transactions/${transferResponse.body.data.publicTransactionId}`)
      .set('Authorization', `Bearer ${alice.accessToken}`);

    expect(aliceDetailResponse.statusCode).toBe(200);
    expect(aliceDetailResponse.body.data.direction).toBe('OUT');
    expect(aliceDetailResponse.body.data.counterparty.accountNumber).toBe(
      bob.account.accountNumber,
    );

    const bobLogin = await loginUser(application, {
      email: 'bob.detail@backend-ledger.local',
      password: 'Password123',
    });

    const bobDetailResponse = await request(application)
      .get(`/api/v1/transactions/${transferResponse.body.data.publicTransactionId}`)
      .set('Authorization', `Bearer ${bobLogin.accessToken}`);

    expect(bobDetailResponse.statusCode).toBe(200);
    expect(bobDetailResponse.body.data.direction).toBe('IN');
    expect(bobDetailResponse.body.data.counterparty.accountNumber).toBe(
      alice.account.accountNumber,
    );

    const charlieDetailResponse = await request(application)
      .get(`/api/v1/transactions/${transferResponse.body.data.publicTransactionId}`)
      .set('Authorization', `Bearer ${charlie.accessToken}`);

    expect(charlieDetailResponse.statusCode).toBe(404);
    expect(charlieDetailResponse.body.error.code).toBe('NOT_FOUND');
  });

  test('account history is hidden from users who do not own the account', async () => {
    const application = createApp();
    const alice = await registerUser(application, {
      email: 'alice.hidden@backend-ledger.local',
      name: 'Alice Hidden',
      password: 'Password123',
    });
    const bob = await registerUser(application, {
      email: 'bob.hidden@backend-ledger.local',
      name: 'Bob Hidden',
      password: 'Password123',
    });

    await depositAsSystem({
      amountMinor: 1000,
      application,
      idempotencyKey: 'hidden-deposit-1',
      reason: 'Hidden history funding',
      toAccountNumber: alice.account.accountNumber,
    });

    const hiddenHistoryResponse = await request(application)
      .get(`/api/v1/accounts/${alice.account.publicAccountId}/transactions`)
      .set('Authorization', `Bearer ${bob.accessToken}`);

    expect(hiddenHistoryResponse.statusCode).toBe(404);
    expect(hiddenHistoryResponse.body.error.code).toBe('ACCOUNT_NOT_FOUND');
  });
});
