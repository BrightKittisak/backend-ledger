class AppError extends Error {
  constructor({ code, details, message, statusCode }) {
    super(message);
    this.code = code;
    this.details = details ?? null;
    this.name = 'AppError';
    this.statusCode = statusCode;
  }
}

module.exports = {
  AppError,
};
