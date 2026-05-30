'use strict';

const { verifyAccessToken } = require('../utils/jwt');
const { ApiError } = require('../utils/apiResponse');
const { prisma } = require('../config/database');

// Authenticate — requires valid JWT
const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw ApiError.unauthorized('No token provided');
  }

  const token = authHeader.split(' ')[1];
  const decoded = verifyAccessToken(token);

  const user = await prisma.user.findUnique({
    where: { id: decoded.sub },
    select: {
      id: true,
      email: true,
      role: true,
      firstName: true,
      lastName: true,
      username: true,
      avatarUrl: true,
      isBanned: true,
      isEmailVerified: true,
      kyc: { select: { status: true } },
    },
  });

  if (!user) throw ApiError.unauthorized('User not found');
  if (user.isBanned) throw ApiError.forbidden('Account has been banned');

  req.user = user;
  next();
};

// Authorize — restrict to specific roles
const authorize = (...roles) => (req, res, next) => {
  if (!req.user) throw ApiError.unauthorized();
  if (!roles.includes(req.user.role)) {
    throw ApiError.forbidden(`Access restricted to: ${roles.join(', ')}`);
  }
  next();
};

// Require KYC approval
const requireKyc = (req, res, next) => {
  const kycStatus = req.user?.kyc?.status;
  if (kycStatus !== 'APPROVED') {
    throw ApiError.forbidden('KYC verification required to access this feature');
  }
  next();
};

// Require verified email
const requireEmailVerified = (req, res, next) => {
  if (!req.user?.isEmailVerified) {
    throw ApiError.forbidden('Please verify your email address first');
  }
  next();
};

module.exports = { authenticate, authorize, requireKyc, requireEmailVerified };
