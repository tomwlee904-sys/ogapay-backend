'use strict';

const express = require('express');
const { authenticate, requireKyc } = require('../middleware/auth.middleware');
const { validate, depositSchema, withdrawSchema } = require('../middleware/validate');
const walletService = require('../services/wallet.service');
const { successResponse } = require('../utils/apiResponse');

const router = express.Router();

// All wallet routes require auth
router.use(authenticate);

// GET /api/v1/wallets
router.get('/', async (req, res) => {
  const wallets = await walletService.getUserWallets(req.user.id);
  successResponse(res, wallets, 'Wallets fetched');
});

// POST /api/v1/wallets/deposit
router.post('/deposit', validate(depositSchema), async (req, res) => {
  const data = await walletService.initiateDeposit(req.user.id, req.body);
  successResponse(res, data, 'Deposit initiated. Complete payment to fund your wallet.');
});

// POST /api/v1/wallets/withdraw
router.post('/withdraw', requireKyc, validate(withdrawSchema), async (req, res) => {
  const data = await walletService.initiateWithdrawal(req.user.id, req.body);
  successResponse(res, data, 'Withdrawal request submitted. Processing within 24 hours.');
});

module.exports = router;
