const { sendSuccess } = require('../../shared/http/responses');
const { getRefreshCookieOptions } = require('../../shared/utils/cookie-options');
const {
  changePassword,
  getCurrentAuthState,
  loginUser,
  logoutUser,
  refreshUserSession,
  registerUser,
} = require('./auth.service');

async function registerController(req, res) {
  const result = await registerUser(req.validated.body);

  res.cookie('refreshToken', result.refreshToken, getRefreshCookieOptions());

  return sendSuccess(res, {
    data: result.authPayload,
    statusCode: 201,
  });
}

async function loginController(req, res) {
  const result = await loginUser(req.validated.body);

  res.cookie('refreshToken', result.refreshToken, getRefreshCookieOptions());

  return sendSuccess(res, {
    data: result.authPayload,
  });
}

async function refreshController(req, res) {
  const result = await refreshUserSession({
    csrfToken: req.validated.headers['x-csrf-token'],
    refreshToken: req.cookies.refreshToken,
  });

  res.cookie('refreshToken', result.refreshToken, getRefreshCookieOptions());

  return sendSuccess(res, {
    data: result.authPayload,
  });
}

async function logoutController(req, res) {
  await logoutUser({
    csrfToken: req.validated.headers['x-csrf-token'],
    refreshToken: req.cookies.refreshToken,
  });

  res.clearCookie('refreshToken', getRefreshCookieOptions());

  return sendSuccess(res, {
    data: null,
  });
}

async function getCurrentAuthStateController(req, res) {
  const authState = await getCurrentAuthState(req.authUser);

  return sendSuccess(res, {
    data: authState,
  });
}

async function changePasswordController(req, res) {
  await changePassword({
    currentPassword: req.validated.body.currentPassword,
    newPassword: req.validated.body.newPassword,
    user: req.authUser,
  });

  res.clearCookie('refreshToken', getRefreshCookieOptions());

  return sendSuccess(res, {
    data: null,
  });
}

module.exports = {
  changePasswordController,
  getCurrentAuthStateController,
  loginController,
  logoutController,
  refreshController,
  registerController,
};
