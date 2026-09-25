const { prisma } = require('../config/database');

const REFERRAL_BONUS_NGN = 500;

async function recordReferralSignup(newUserId, referralCode) {
  if (!referralCode) return;

  const referrer = await prisma.user.findUnique({
    where: { referralCode },
    select: { id: true },
  });

  if (!referrer || referrer.id === newUserId) return;

  await prisma.referral.create({
    data: {
      referrerId: referrer.id,
      referredId: newUserId,
      referralCode,
      status: 'pending',
      bonusAmount: REFERRAL_BONUS_NGN,
    },
  });
}

async function maybeTriggerReferralBonus(referredUserId) {
  const referral = await prisma.referral.findUnique({
    where: { referredId: referredUserId },
  });

  if (!referral || referral.status !== 'pending') return;

  const completedCount = await prisma.taskSubmission.count({
    where: {
      workerId: referredUserId,
      status: { in: ['APPROVED', 'PAID'] },
    },
  });

  if (completedCount !== 1) return;

  const referrerWallet = await prisma.wallet.findUnique({
    where: { userId_currency: { userId: referral.referrerId, currency: 'NGN' } },
  });

  if (!referrerWallet) return;

  const newBalance = parseFloat(referrerWallet.balance) + REFERRAL_BONUS_NGN;
  const reference = `OGA-REF-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  await prisma.$transaction(async (db) => {
    // Claim the referral first: a second call at the same moment finds it completed
    const { count } = await db.referral.updateMany({
      where: { id: referral.id, status: 'pending' },
      data: { status: 'completed', firstTaskCompletedAt: new Date(), bonusPaidAt: new Date() },
    });
    if (count === 0) return;

    await db.wallet.update({
      where: { id: referrerWallet.id },
      data: { balance: { increment: REFERRAL_BONUS_NGN } },
    });

    await db.transaction.create({
      data: {
        userId: referral.referrerId,
        walletId: referrerWallet.id,
        type: 'REFERRAL_BONUS',
        status: 'COMPLETED',
        amount: REFERRAL_BONUS_NGN,
        currency: 'NGN',
        reference,
        description: 'Referral bonus — friend completed their first task',
        balanceBefore: parseFloat(referrerWallet.balance),
        balanceAfter: newBalance,
      },
    });

  });
}

module.exports = { recordReferralSignup, maybeTriggerReferralBonus };
