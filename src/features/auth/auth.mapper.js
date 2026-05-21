function buildUserProfile(user) {
  return {
    email: user.email,
    name: user.name,
    publicUserId: user.publicUserId,
    role: user.role,
  };
}

module.exports = {
  buildUserProfile,
};
