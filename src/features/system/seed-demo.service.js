const { UserModel } = require('../users/user.model');
const { runInTransaction } = require('../../shared/db/mongoose-session');
const { hashPassword } = require('../../shared/utils/passwords');
const { createUserWithPrimaryAccount } = require('../users/user-account.service');

const demoUsers = [
  {
    email: 'alice.demo@backend-ledger.local',
    name: 'Alice Demo',
    password: 'DemoPass123',
  },
  {
    email: 'bob.demo@backend-ledger.local',
    name: 'Bob Demo',
    password: 'DemoPass123',
  },
  {
    email: 'charlie.demo@backend-ledger.local',
    name: 'Charlie Demo',
    password: 'DemoPass123',
  },
];

async function seedDemoUsers() {
  let createdCount = 0;

  for (const demoUser of demoUsers) {
    const existingUser = await UserModel.findOne({ email: demoUser.email });

    if (existingUser) {
      continue;
    }

    await runInTransaction(async (session) => {
      const passwordHash = await hashPassword(demoUser.password);

      await createUserWithPrimaryAccount({
        email: demoUser.email,
        name: demoUser.name,
        passwordHash,
        session,
      });
    });

    createdCount += 1;
  }

  return {
    createdCount,
    users: demoUsers.map(({ email, name, password }) => ({
      email,
      name,
      password,
    })),
  };
}

module.exports = {
  seedDemoUsers,
};
