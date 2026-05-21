const { MongoMemoryReplSet } = require('mongodb-memory-server');
const request = require('supertest');

describe('slice 1 integration', () => {
  let createApp;
  let assertBootstrapReady;
  let connectToDatabase;
  let ensureSystemBootstrap;
  let mongoose;
  let prepareDatabase;
  let resetRuntimeState;
  let seedDemoUsers;
  let replSet;

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
    ({ connectToDatabase } = require('../../src/shared/db/connect-to-database'));
    ({ prepareDatabase } = require('../../src/shared/db/prepare-database'));
    ({ resetRuntimeState } = require('../../src/shared/runtime/runtime-state'));
    ({ ensureSystemBootstrap, assertBootstrapReady } = require('../../src/features/system/bootstrap.service'));
    ({ seedDemoUsers } = require('../../src/features/system/seed-demo.service'));

    await connectToDatabase(process.env.MONGO_URI);
  });

  beforeEach(async () => {
    if (mongoose.connection.db) {
      await mongoose.connection.db.dropDatabase();
    }

    await prepareDatabase();
    resetRuntimeState();
    await ensureSystemBootstrap();
    await assertBootstrapReady();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (replSet) {
      await replSet.stop();
    }
  });

  test('bootstrap and demo seed are idempotent', async () => {
    const firstBootstrap = await ensureSystemBootstrap();
    const secondBootstrap = await ensureSystemBootstrap();
    const firstSeed = await seedDemoUsers();
    const secondSeed = await seedDemoUsers();

    expect(firstBootstrap.created).toBe(false);
    expect(secondBootstrap.created).toBe(false);
    expect(firstSeed.createdCount).toBe(3);
    expect(secondSeed.createdCount).toBe(0);
  });

  test('health and readiness endpoints respond successfully', async () => {
    const application = createApp();

    const healthResponse = await request(application).get('/health');
    const readinessResponse = await request(application).get('/ready');

    expect(healthResponse.statusCode).toBe(200);
    expect(healthResponse.body.success).toBe(true);
    expect(readinessResponse.statusCode).toBe(200);
    expect(readinessResponse.body.data.ready).toBe(true);
    expect(readinessResponse.body.data.checks.email.enabled).toBe(false);
  });

  test('register, auth/me, accounts/me, refresh, logout, and password change flow works', async () => {
    const application = createApp();
    const agent = request.agent(application);

    const registerResponse = await agent.post('/api/v1/auth/register').send({
      email: 'new.user@backend-ledger.local',
      name: 'New User',
      password: 'Password123',
    });

    expect(registerResponse.statusCode).toBe(201);
    expect(registerResponse.body.data.user.email).toBe('new.user@backend-ledger.local');
    expect(registerResponse.body.data.primaryAccount.currency).toBe('THB');
    expect(registerResponse.body.data.primaryAccount.currentBalanceMinor).toBe(0);
    expect(registerResponse.body.data.primaryAccount.accountNumber).toHaveLength(10);
    expect(registerResponse.headers['set-cookie'][0]).toContain('refreshToken=');

    const accessToken = registerResponse.body.data.accessToken;
    const registerCsrfToken = registerResponse.body.data.csrfToken;
    const publicAccountId = registerResponse.body.data.primaryAccount.publicAccountId;

    const authStateResponse = await agent
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(authStateResponse.statusCode).toBe(200);
    expect(authStateResponse.body.data.user.publicUserId).toBeTruthy();

    const accountResponse = await agent
      .get('/api/v1/accounts/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(accountResponse.statusCode).toBe(200);
    expect(accountResponse.body.data.publicAccountId).toBe(publicAccountId);

    const ownedAccountResponse = await agent
      .get(`/api/v1/accounts/${publicAccountId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(ownedAccountResponse.statusCode).toBe(200);
    expect(ownedAccountResponse.body.data.publicAccountId).toBe(publicAccountId);

    const refreshResponse = await agent
      .post('/api/v1/auth/refresh')
      .set('X-CSRF-Token', registerCsrfToken);

    expect(refreshResponse.statusCode).toBe(200);
    expect(refreshResponse.body.data.accessToken).toBeTruthy();
    expect(refreshResponse.body.data.csrfToken).toBeTruthy();
    expect(refreshResponse.body.data.primaryAccount.publicAccountId).toBe(publicAccountId);

    const logoutResponse = await agent
      .post('/api/v1/auth/logout')
      .set('X-CSRF-Token', refreshResponse.body.data.csrfToken);

    expect(logoutResponse.statusCode).toBe(200);
    expect(logoutResponse.body.data).toBeNull();

    const loginResponse = await agent.post('/api/v1/auth/login').send({
      email: 'new.user@backend-ledger.local',
      password: 'Password123',
    });

    expect(loginResponse.statusCode).toBe(200);

    const changePasswordResponse = await agent
      .patch('/api/v1/auth/password')
      .set('Authorization', `Bearer ${loginResponse.body.data.accessToken}`)
      .send({
        currentPassword: 'Password123',
        newPassword: 'NewPassword123',
      });

    expect(changePasswordResponse.statusCode).toBe(200);
    expect(changePasswordResponse.body.data).toBeNull();

    const oldPasswordLoginResponse = await agent.post('/api/v1/auth/login').send({
      email: 'new.user@backend-ledger.local',
      password: 'Password123',
    });

    expect(oldPasswordLoginResponse.statusCode).toBe(401);

    const newPasswordLoginResponse = await agent.post('/api/v1/auth/login').send({
      email: 'new.user@backend-ledger.local',
      password: 'NewPassword123',
    });

    expect(newPasswordLoginResponse.statusCode).toBe(200);
    expect(newPasswordLoginResponse.body.data.primaryAccount.publicAccountId).toBe(publicAccountId);
  });
});
