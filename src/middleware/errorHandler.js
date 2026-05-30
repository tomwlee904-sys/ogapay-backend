'use strict';

const { logger } = require('../utils/logger');
const { ApiError } = require('../utils/apiResponse');

const errorHandler = (err, req, res, next) => {
  logger.error(`${req.method} ${req.url} — ${err.message}`, {
    stack: err.stack,
    statusCode: err.statusCode,
  });

  // Known operational errors
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: err.errors.length ? err.errors : undefined,
    });
  }

  // Prisma errors
  if (err.code === 'P2002') {
    const field = err.meta?.target?.[0];
    return res.status(409).json({
      success: false,
      message: `${field ? `'${field}'` : 'A value'} already exists`,
    });
  }

  if (err.code === 'P2025') {
    return res.status(404).json({
      success: false,
      message: 'Record not found',
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ success: false, message: 'Token expired' });
  }

  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ success: false, message: 'File too large' });
  }

  // Default
  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'An unexpected error occurred'
    : err.message;

  return res.status(statusCode).json({ success: false, message });
};

module.exports = { errorHandler };
