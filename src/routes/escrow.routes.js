'use strict';

const express = require('express');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const escrowController = require('../controllers/escrow.controller');

const router = express.Router();

router.use(authenticate);

router.get('/status/:taskId', escrowController.getStatus);
router.get('/history', escrowController.getHistory);
router.post('/release/:submissionId', escrowController.release);
router.post('/refund/:taskId', escrowController.refund);
router.post('/dispute/:submissionId', escrowController.dispute);
router.post('/resolve/:disputeId', authorize('ADMIN'), escrowController.resolve);

module.exports = router;
