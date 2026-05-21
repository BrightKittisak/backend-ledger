const nodemailer = require('nodemailer');

const { config } = require('../../shared/config/env');
const { logger } = require('../../shared/logger/logger');

let transporter = null;

function getTransporter() {
  if (!config.email.enabled) {
    return null;
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      auth: {
        clientId: config.email.clientId,
        clientSecret: config.email.clientSecret,
        refreshToken: config.email.refreshToken,
        type: 'OAuth2',
        user: config.email.user,
      },
      service: 'gmail',
    });
  }

  return transporter;
}

async function sendWelcomeEmail({ email, name }) {
  const activeTransporter = getTransporter();

  if (!activeTransporter) {
    logger.warn({ email }, 'Welcome email skipped because email is disabled');
    return;
  }

  try {
    await activeTransporter.sendMail({
      from: `"Backend Ledger" <${config.email.user}>`,
      html: `<p>Hello ${name}, welcome to Backend Ledger.</p>`,
      subject: 'Welcome to Backend Ledger',
      text: `Hello ${name}, welcome to Backend Ledger.`,
      to: email,
    });
  } catch (error) {
    logger.error({ email, err: error }, 'Failed to send welcome email');
  }
}

async function sendTransferSuccessEmail({
  amountMinor,
  currency,
  email,
  name,
  toAccountNumber,
}) {
  const activeTransporter = getTransporter();

  if (!activeTransporter) {
    logger.warn({ email }, 'Transfer success email skipped because email is disabled');
    return;
  }

  try {
    await activeTransporter.sendMail({
      from: `"Backend Ledger" <${config.email.user}>`,
      html: `<p>Hello ${name}, your transfer of ${amountMinor} ${currency} to ${toAccountNumber} was successful.</p>`,
      subject: 'Transfer completed successfully',
      text: `Hello ${name}, your transfer of ${amountMinor} ${currency} to ${toAccountNumber} was successful.`,
      to: email,
    });
  } catch (error) {
    logger.error({ email, err: error }, 'Failed to send transfer success email');
  }
}

module.exports = {
  sendTransferSuccessEmail,
  sendWelcomeEmail,
};
