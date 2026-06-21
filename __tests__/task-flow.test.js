'use strict'

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_access_secret_32_chars_minimum'
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test_refresh_secret_32_chars_minimum'
process.env.PLATFORM_FEE_PERCENT = '10'

const request = require('supertest')
const app = require('../src/index')
const { prisma } = require('../src/config/database')
const { signAccessToken } = require('../src/utils/jwt')

let poster, worker, worker2, task, submission, submission2

async function createTestUser({ role, kycStatus }) {
  const ts = Date.now()
  const rand = Math.random().toString(36).slice(2, 8)
  const email = `test_${ts}_${rand}@test.com`

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: 'hashedpassword',
      role,
      username: `testuser_${ts}_${rand}`,
      firstName: 'Test',
      lastName: 'User',
      isEmailVerified: true,
      referralCode: `REF_${ts}_${rand}`,
      kyc: kycStatus === 'APPROVED'
        ? { create: { status: 'APPROVED', idType: 'NIN' } }
        : undefined,
      workerProfile: role === 'WORKER'
        ? { create: {} }
        : undefined,
      posterProfile: role === 'POSTER'
        ? { create: {} }
        : undefined,
    },
  })

  await prisma.wallet.create({
    data: { userId: user.id, currency: 'NGN', balance: 10000, lockedBalance: 0 },
  })

  const token = signAccessToken({ sub: user.id, role: user.role })

  return { ...user, token }
}

afterAll(async () => {
  // Delete in correct order to avoid FK violations
  const testUsers = await prisma.user.findMany({
    where: { email: { contains: '@test.com' } },
    select: { id: true },
  })
  const userIds = testUsers.map(u => u.id)

  if (userIds.length > 0) {
    const testTasks = await prisma.task.findMany({
      where: { posterId: { in: userIds } },
      select: { id: true },
    })
    const taskIds = testTasks.map(t => t.id)

    if (taskIds.length > 0) {
      await prisma.taskSubmission.deleteMany({ where: { taskId: { in: taskIds } } })
      await prisma.task.deleteMany({ where: { id: { in: taskIds } } })
    }

    await prisma.communityMessage.deleteMany({ where: { senderId: { in: userIds } } })
    await prisma.communityRequest.deleteMany({ where: { userId: { in: userIds } } })
    await prisma.communityMember.deleteMany({ where: { userId: { in: userIds } } })
    await prisma.community.deleteMany({ where: { ownerId: { in: userIds } } })
    await prisma.transaction.deleteMany({ where: { userId: { in: userIds } } })
    await prisma.wallet.deleteMany({ where: { userId: { in: userIds } } })
    await prisma.notification.deleteMany({ where: { userId: { in: userIds } } })
    await prisma.kycVerification.deleteMany({ where: { userId: { in: userIds } } })
    await prisma.workerProfile.deleteMany({ where: { userId: { in: userIds } } })
    await prisma.posterProfile.deleteMany({ where: { userId: { in: userIds } } })
    await prisma.user.deleteMany({ where: { id: { in: userIds } } })
  }
  await prisma.$disconnect()
})

describe('Task lifecycle E2E', () => {
  it('Step 1 — Poster creates a task', async () => {
    poster = await createTestUser({ role: 'POSTER', kycStatus: 'APPROVED' })

    const deadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    const res = await request(app)
      .post('/api/v1/tasks')
      .set('Authorization', `Bearer ${poster.token}`)
      .send({
        title: 'Follow @OgaPay on Twitter',
        description: 'Follow our Twitter account and screenshot proof. Make sure to include your profile name.',
        category: 'SOCIAL_MEDIA',
        reward: 500,
        currency: 'NGN',
        maxWorkers: 5,
        instructions: '1. Go to twitter.com/ogapay 2. Click Follow 3. Screenshot your profile showing you follow us',
        proofRequired: 'Screenshot of following',
        deadline,
      })
      .expect(201)

    expect(res.body.success).toBe(true)
    task = res.body.data
    expect(task.status).toBe('OPEN')
    expect(task.posterId).toBe(poster.id)
    expect(Number(task.reward)).toBe(500)
    expect(task.maxWorkers).toBe(5)

    const posterWallet = await prisma.wallet.findUnique({
      where: { userId_currency: { userId: poster.id, currency: 'NGN' } },
    })
    // Started with 10000, fee = 2500 * 10% = 250
    expect(Number(posterWallet.balance)).toBe(9750)
    expect(Number(posterWallet.lockedBalance)).toBe(2500)
  })

  it('Step 2 — Worker views available tasks', async () => {
    worker = await createTestUser({ role: 'WORKER', kycStatus: 'APPROVED' })

    const res = await request(app)
      .get('/api/v1/tasks')
      .query({ status: 'OPEN', category: 'SOCIAL_MEDIA' })
      .set('Authorization', `Bearer ${worker.token}`)
      .expect(200)

    expect(res.body.success).toBe(true)
    const tasks = res.body.data
    expect(Array.isArray(tasks)).toBe(true)
    expect(tasks.length).toBeGreaterThanOrEqual(1)

    const found = tasks.find(t => t.id === task.id)
    expect(found).toBeTruthy()
    expect(found.title).toBe('Follow @OgaPay on Twitter')
    expect(Number(found.reward)).toBe(500)
  })

  it('Step 3 — Worker applies to task', async () => {
    const res = await request(app)
      .post(`/api/v1/tasks/${task.id}/apply`)
      .set('Authorization', `Bearer ${worker.token}`)
      .expect(201)

    expect(res.body.success).toBe(true)
    submission = res.body.data
    expect(submission.status).toBe('PENDING')
    expect(submission.workerId).toBe(worker.id)
    expect(submission.taskId).toBe(task.id)
  })

  it('Step 4 — Worker submits proof', async () => {
    const res = await request(app)
      .post(`/api/v1/tasks/${task.id}/submit`)
      .set('Authorization', `Bearer ${worker.token}`)
      .send({
        proof: 'https://screenshot.url/proof.jpg',
        workerNotes: 'I followed the account as instructed',
      })
      .expect(200)

    expect(res.body.success).toBe(true)
    submission = res.body.data
    expect(submission.status).toBe('SUBMITTED')
    expect(submission.proof).toBe('https://screenshot.url/proof.jpg')
    expect(submission.workerNotes).toBe('I followed the account as instructed')
    expect(submission.submittedAt).toBeTruthy()
  })

  it('Step 5 — Poster views submissions', async () => {
    const res = await request(app)
      .get(`/api/v1/tasks/${task.id}/submissions`)
      .set('Authorization', `Bearer ${poster.token}`)
      .expect(200)

    expect(res.body.success).toBe(true)
    const submissions = res.body.data
    expect(Array.isArray(submissions)).toBe(true)
    expect(submissions.length).toBe(1)
    expect(submissions[0].status).toBe('SUBMITTED')
    expect(submissions[0].workerId).toBe(worker.id)
    expect(submissions[0].worker).toBeDefined()
    expect(submissions[0].worker.username).toBeTruthy()
  })

  it('Step 6 — Poster approves submission', async () => {
    const res = await request(app)
      .patch(`/api/v1/tasks/submissions/${submission.id}/review`)
      .set('Authorization', `Bearer ${poster.token}`)
      .send({
        status: 'APPROVED',
        feedback: 'Great work, confirmed the follow',
      })
      .expect(200)

    expect(res.body.success).toBe(true)
    submission = res.body.data
    expect(submission.status).toBe('APPROVED')

    const workerWallet = await prisma.wallet.findUnique({
      where: { userId_currency: { userId: worker.id, currency: 'NGN' } },
    })
    // Worker started with 10000 + 500 reward = 10500
    expect(Number(workerWallet.balance)).toBe(10500)

    const workerTx = await prisma.transaction.findFirst({
      where: { userId: worker.id, type: 'TASK_PAYMENT', status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
    })
    expect(workerTx).toBeTruthy()
    expect(Number(workerTx.amount)).toBe(500)

    const posterWallet = await prisma.wallet.findUnique({
      where: { userId_currency: { userId: poster.id, currency: 'NGN' } },
    })
    // Poster: 9750 - 500 = 9250, locked: 2500 - 500 = 2000
    expect(Number(posterWallet.balance)).toBe(9250)
    expect(Number(posterWallet.lockedBalance)).toBe(2000)
  })

  it('Step 7 — Verify wallet balances', async () => {
    // Worker balance
    const workerRes = await request(app)
      .get('/api/v1/wallet/balance')
      .set('Authorization', `Bearer ${worker.token}`)
      .expect(200)

    expect(workerRes.body.success).toBe(true)
    const wBal = workerRes.body.data.NGN
    expect(Number(wBal.balance)).toBe(10500)
    expect(Number(wBal.available)).toBe(10500)

    // Poster balance
    const posterRes = await request(app)
      .get('/api/v1/wallet/balance')
      .set('Authorization', `Bearer ${poster.token}`)
      .expect(200)

    expect(posterRes.body.success).toBe(true)
    const pBal = posterRes.body.data.NGN
    // 9750 after task creation fee, minus 500 for worker 1 approval
    expect(Number(pBal.balance)).toBe(9250)
    expect(Number(pBal.lockedBalance)).toBe(2000)
    expect(Number(pBal.available)).toBe(7250)
  })

  it('Step 8 — Poster rejects a second submission', async () => {
    worker2 = await createTestUser({ role: 'WORKER', kycStatus: 'APPROVED' })

    // Worker 2 applies
    const applyRes = await request(app)
      .post(`/api/v1/tasks/${task.id}/apply`)
      .set('Authorization', `Bearer ${worker2.token}`)
      .expect(201)

    submission2 = applyRes.body.data

    // Worker 2 submits
    const submitRes = await request(app)
      .post(`/api/v1/tasks/${task.id}/submit`)
      .set('Authorization', `Bearer ${worker2.token}`)
      .send({
        proof: 'https://screenshot.url/fake-proof.jpg',
        workerNotes: 'I followed the account',
      })
      .expect(200)

    submission2 = submitRes.body.data
    expect(submission2.status).toBe('SUBMITTED')

    // Poster rejects
    const rejectRes = await request(app)
      .patch(`/api/v1/tasks/submissions/${submission2.id}/review`)
      .set('Authorization', `Bearer ${poster.token}`)
      .send({
        status: 'REJECTED',
        feedback: 'Proof not valid',
      })
      .expect(200)

    expect(rejectRes.body.success).toBe(true)
    expect(rejectRes.body.data.status).toBe('REJECTED')

    // Worker 2 wallet unchanged (still 10000)
    const w2Wallet = await prisma.wallet.findUnique({
      where: { userId_currency: { userId: worker2.id, currency: 'NGN' } },
    })
    expect(Number(w2Wallet.balance)).toBe(10000)

    // Poster wallet and locked balance unchanged from Step 6
    const posterWallet = await prisma.wallet.findUnique({
      where: { userId_currency: { userId: poster.id, currency: 'NGN' } },
    })
    expect(Number(posterWallet.balance)).toBe(9250)
    expect(Number(posterWallet.lockedBalance)).toBe(2000)
  })

  it('Step 9 — Task completes when all slots filled', async () => {
    const workers3to5 = []
    for (let i = 0; i < 3; i++) {
      const w = await createTestUser({ role: 'WORKER', kycStatus: 'APPROVED' })
      workers3to5.push(w)

      const applyRes = await request(app)
        .post(`/api/v1/tasks/${task.id}/apply`)
        .set('Authorization', `Bearer ${w.token}`)
        .expect(201)

      const subRes = await request(app)
        .post(`/api/v1/tasks/${task.id}/submit`)
        .set('Authorization', `Bearer ${w.token}`)
        .send({
          proof: `https://screenshot.url/proof${i}.jpg`,
          workerNotes: 'Done',
        })
        .expect(200)

      await request(app)
        .patch(`/api/v1/tasks/submissions/${subRes.body.data.id}/review`)
        .set('Authorization', `Bearer ${poster.token}`)
        .send({ status: 'APPROVED', feedback: 'Good' })
        .expect(200)
    }

    // After all 5 slots resolved (4 approved + 1 rejected), task should be COMPLETED
    const finalTask = await prisma.task.findUnique({ where: { id: task.id } })
    expect(finalTask.status).toBe('COMPLETED')

    const posterWallet = await prisma.wallet.findUnique({
      where: { userId_currency: { userId: poster.id, currency: 'NGN' } },
    })
    // Locked should be 0 (remaining refunded)
    expect(Number(posterWallet.lockedBalance)).toBe(0)
  })

  it('Step 10 — Unauthorized access tests', async () => {
    // Worker cannot approve submissions
    const workerRes = await request(app)
      .patch(`/api/v1/tasks/submissions/${submission.id}/review`)
      .set('Authorization', `Bearer ${worker.token}`)
      .send({ status: 'APPROVED', feedback: 'hack' })
    expect(workerRes.status).toBe(403)

    // Unauthenticated user cannot create task
    const unauthRes = await request(app)
      .post('/api/v1/tasks')
      .send({
        title: 'Hack attempt',
        description: 'Should not be allowed to create a task without auth',
        category: 'SOCIAL_MEDIA',
        reward: 100,
      })
    expect(unauthRes.status).toBe(401)

    // Worker cannot create task (only POSTER role)
    const workerCreateRes = await request(app)
      .post('/api/v1/tasks')
      .set('Authorization', `Bearer ${worker.token}`)
      .send({
        title: 'Worker trying to create task',
        description: 'Workers should not be able to create tasks. This is a test.',
        category: 'SOCIAL_MEDIA',
        reward: 100,
        maxWorkers: 1,
      })
    expect(workerCreateRes.status).toBe(403)
  })
})
