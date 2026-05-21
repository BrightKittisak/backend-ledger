const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    publicUserId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
    },
    role: {
      type: String,
      enum: ['USER', 'SYSTEM'],
      default: 'USER',
      required: true,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'SUSPENDED'],
      default: 'ACTIVE',
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

const UserModel = mongoose.models.User || mongoose.model('User', userSchema);

module.exports = {
  UserModel,
};
