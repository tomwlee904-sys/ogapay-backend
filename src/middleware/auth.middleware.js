'use strict';

const { verifyAccessToken } = require('../utils/jwt');
const { ApiError } = require('../utils/apiResponse');
const { prisma } = require('../config/database');

// Try to verify with Supabase (for Google OAuth tokens from frontend)
const { supabaseAdmin } = require('../config/supabase');

async function findUserByIdentity(identity) {
  return prisma.user.findUnique({
    where: { id: identity.sub || identity.id },
    select: {
      id: true, email: true, role: true,
      firstName: true, lastName: true, username: true,
      avatarUrl: true, isBanned: true, isEmailVerified: true,
      kyc: { select: { status: true } },
    },
  });
}

// Authenticate — requires valid JWT (backend JWT or Supabase session token)
const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw ApiError.unauthorized('No token provided');
  }

  const token = authHeader.split(' ')[1];
  let user = null;

  // Try 1: Verify as backend JWT
  try {
    const decoded = verifyAccessToken(token);
    user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: {
        id: true, email: true, role: true,
        firstName: true, lastName: true, username: true,
        avatarUrl: true, isBanned: true, isEmailVerified: true,
        kyc: { select: { status: true } },
      },
    });
  } catch {
    // Not a valid backend JWT — try Supabase
  }

  // Try 2: Verify as Supabase session token
  if (!user) {
    try {
      const { data, error } = await supabaseAdmin.auth.getUser(token);
      if (!error && data?.user?.email) {
        user = await prisma.user.findFirst({
          where: { email: data.user.email.toLowerCase() },
          select: {
            id: true, email: true, role: true,
            firstName: true, lastName: true, username: true,
            avatarUrl: true, isBanned: true, isEmailVerified: true,
            kyc: { select: { status: true } },
          },
        });
      }
    } catch {
      // Supabase verification also failed
    }
  }

  if (!user) throw ApiError.unauthorized('Invalid access token');
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

// Optional auth — attaches user if token present, continues regardless
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return next();

  const token = authHeader.split(' ')[1];
  let user = null;

  // Try backend JWT
  try {
    const decoded = verifyAccessToken(token);
    user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: {
        id: true, email: true, role: true,
        firstName: true, lastName: true, username: true,
        avatarUrl: true, isBanned: true, isEmailVerified: true,
        kyc: { select: { status: true } },
      },
    });
  } catch { /* not a backend JWT */ }

  // Try Supabase token
  if (!user) {
    try {
      const { data, error } = await supabaseAdmin.auth.getUser(token);
      if (!error && data?.user?.email) {
        user = await prisma.user.findFirst({
          where: { email: data.user.email.toLowerCase() },
          select: {
            id: true, email: true, role: true,
            firstName: true, lastName: true, username: true,
            avatarUrl: true, isBanned: true, isEmailVerified: true,
            kyc: { select: { status: true } },
          },
        });
      }
    } catch { /* supabase also failed */ }
  }

  if (user && !user.isBanned) req.user = user;
  next();
};

module.exports = { authenticate, authorize, requireKyc, requireEmailVerified, optionalAuth };
