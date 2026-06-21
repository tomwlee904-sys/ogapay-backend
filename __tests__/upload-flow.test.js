'use strict'

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_access_secret_32_chars_minimum'
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test_refresh_secret_32_chars_minimum'
process.env.PLATFORM_FEE_PERCENT = '10'

const request = require('supertest')
const app = require('../src/index')
const { prisma } = require('../src/config/database')
const { signAccessToken } = require('../src/utils/jwt')

let poster, worker, task, submission

function createPngBuf() {
  return Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE,
    0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, 0x54,
    0x08, 0xD7, 0x63, 0x60, 0x60, 0x60, 0x00, 0x00, 0x00, 0x04, 0x00, 0x01, 0x27, 0x34, 0x27, 0x0A,
    0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82,
  ])
}

function createPdfBuf() {
  return Buffer.from(
    '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n190\n%%EOF'
  )
}

function createDocxBuf() {
  return Buffer.from('PK\u0003\u0004\u0014\u0000\u0000\u0000\u0000\u0000', 'latin1')
}

async function createTestUser({ role, kycStatus }) {
  const ts = Date.now()
  const rand = Math.random().toString(36).slice(2, 8)
  const email = `upload_${ts}_${rand}@test.com`

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: 'hashedpassword',
      role,
      username: `upload_${ts}_${rand}`,
      firstName: 'Upload',
      lastName: 'Test',
      isEmailVerified: true,
      referralCode: `REF_${ts}_${rand}`,
      kyc: kycStatus === 'APPROVED'
        ? { create: { status: 'APPROVED', idType: 'NIN' } }
        : undefined,
      workerProfile: role === 'WORKER' ? { create: {} } : undefined,
      posterProfile: role === 'POSTER' ? { create: {} } : undefined,
    },
  })

  await prisma.wallet.create({
    data: { userId: user.id, currency: 'NGN', balance: 10000, lockedBalance: 0 },
  })

  const token = signAccessToken({ sub: user.id, role: user.role })
  return { ...user, token }
}

afterAll(async () => {
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

describe('Multipart upload — task submission attachments', () => {
  it('creates poster + task + worker + apply', async () => {
    poster = await createTestUser({ role: 'POSTER', kycStatus: 'APPROVED' })
    worker = await createTestUser({ role: 'WORKER', kycStatus: 'APPROVED' })

    await prisma.$queryRawUnsafe('SELECT 1')

    const deadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    const taskRes = await request(app)
      .post('/api/v1/tasks')
      .set('Authorization', `Bearer ${poster.token}`)
      .send({
        title: 'Upload test task',
        description: 'Submit files as proof',
        category: 'SOCIAL_MEDIA',
        reward: 50,
        currency: 'NGN',
        maxWorkers: 3,
        instructions: 'Upload your files',
        deadline,
      })
      .expect(201)
    task = taskRes.body.data

    const applyRes = await request(app)
      .post(`/api/v1/tasks/${task.id}/apply`)
      .set('Authorization', `Bearer ${worker.token}`)
      .expect(201)
    submission = applyRes.body.data
  })

  it('submits proof with PNG, PDF, and DOCX attachments', async () => {
    const pngBuf = createPngBuf()
    const pdfBuf = createPdfBuf()
    const docxBuf = createDocxBuf()

    const res = await request(app)
      .post(`/api/v1/tasks/${task.id}/submit`)
      .set('Authorization', `Bearer ${worker.token}`)
      .field('proof', 'https://example.com/proof')
      .field('workerNotes', 'Attached all required file types')
      .attach('attachments', pngBuf, 'screenshot.png')
      .attach('attachments', pdfBuf, 'report.pdf')
      .attach('attachments', docxBuf, 'summary.docx')
      .expect(200)

    expect(res.body.success).toBe(true)
    submission = res.body.data
    expect(submission.status).toBe('SUBMITTED')
    expect(submission.attachments).toBeDefined()
    expect(Array.isArray(submission.attachments)).toBe(true)
    expect(submission.attachments.length).toBe(3)

    const png = submission.attachments.find(a => a.name === 'screenshot.png')
    expect(png).toBeDefined()
    expect(png.mimetype).toBe('image/png')
    expect(png.size).toBe(pngBuf.length)
    expect(png.buffer).toBeDefined()

    const pdf = submission.attachments.find(a => a.name === 'report.pdf')
    expect(pdf).toBeDefined()
    expect(pdf.mimetype).toBe('application/pdf')
    expect(pdf.size).toBe(pdfBuf.length)
    expect(pdf.buffer).toBeDefined()

    const docx = submission.attachments.find(a => a.name === 'summary.docx')
    expect(docx).toBeDefined()
    expect(docx.mimetype).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    expect(docx.size).toBe(docxBuf.length)
    expect(docx.buffer).toBeDefined()
  })

  it('retrieves attachments via GET submissions endpoint', async () => {
    const res = await request(app)
      .get(`/api/v1/tasks/${task.id}/submissions`)
      .set('Authorization', `Bearer ${poster.token}`)
      .expect(200)

    expect(res.body.success).toBe(true)
    const subs = res.body.data
    expect(Array.isArray(subs)).toBe(true)
    const sub = subs.find(s => s.id === submission.id)
    expect(sub).toBeDefined()
    expect(sub.attachments).toBeDefined()
    expect(Array.isArray(sub.attachments)).toBe(true)
    expect(sub.attachments.length).toBe(3)

    const names = sub.attachments.map(a => a.name).sort()
    expect(names).toEqual(['report.pdf', 'screenshot.png', 'summary.docx'])
  })

  it('persists attachments in database as JSON', async () => {
    const dbSub = await prisma.taskSubmission.findUnique({
      where: { id: submission.id },
      select: { attachments: true },
    })
    expect(dbSub.attachments).toBeDefined()
    expect(Array.isArray(dbSub.attachments)).toBe(true)
    expect(dbSub.attachments.length).toBe(3)

    const names = dbSub.attachments.map(a => a.name).sort()
    expect(names).toEqual(['report.pdf', 'screenshot.png', 'summary.docx'])

    for (const att of dbSub.attachments) {
      expect(att.buffer).toBeDefined()
      expect(typeof att.buffer).toBe('string')
      expect(att.buffer.length).toBeGreaterThan(10)
    }
  })
})
