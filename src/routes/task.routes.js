'use strict';

const express = require('express');
const multer = require('multer');
const { authenticate, authorize, requireKyc } = require('../middleware/auth.middleware');
const { validate, createTaskSchema, submitTaskSchema, reviewSubmissionSchema } = require('../middleware/validate');
const taskService = require('../services/task.service');
const { successResponse, createdResponse, paginatedResponse, paginate } = require('../utils/apiResponse');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 5 } });

// GET /api/v1/tasks — Public task listing
router.get('/', async (req, res) => {
  const { category, status, page = 1, limit = 20, search, currency, minReward, maxReward, sortBy, sortOrder } = req.query;
  const { tasks, total } = await taskService.listTasks({
    category, status, page, limit, search, currency,
    minReward: minReward ? parseFloat(minReward) : undefined,
    maxReward: maxReward ? parseFloat(maxReward) : undefined,
    sortBy, sortOrder,
  });
  paginatedResponse(res, tasks, paginate(page, limit, total));
});


// POST /api/v1/tasks — Poster creates task
router.post(
  '/',
  authenticate,
  authorize('POSTER', 'ADMIN'),
  requireKyc,
  validate(createTaskSchema),
  async (req, res) => {
    const task = await taskService.createTask(req.user.id, req.body);
    createdResponse(res, task, 'Task created and funds escrowed');
  },
);

// POST /api/v1/tasks/:id/apply — Worker applies
router.post(
  '/:id/apply',
  authenticate,
  authorize('WORKER', 'ADMIN'),
  async (req, res) => {
    const submission = await taskService.applyToTask(req.user.id, req.params.id);
    createdResponse(res, submission, 'Applied to task successfully');
  },
);

// POST /api/v1/tasks/:id/submit — Worker submits proof
router.post(
  '/:id/submit',
  authenticate,
  authorize('WORKER', 'ADMIN'),
  upload.array('attachments', 5),
  validate(submitTaskSchema),
  async (req, res) => {
    const attachments = req.files?.map((f) => ({
      name: f.originalname,
      size: f.size,
      mimetype: f.mimetype,
      // In production: upload to Supabase Storage and store URLs
      buffer: f.buffer.toString('base64'),
    }));
    const submission = await taskService.submitTask(req.user.id, req.params.id, {
      ...req.body,
      attachments,
    });
    successResponse(res, submission, 'Submission sent for review');
  },
);

// PATCH /api/v1/tasks/submissions/:submissionId/review — Poster reviews
router.patch(
  '/submissions/:submissionId/review',
  authenticate,
  authorize('POSTER', 'ADMIN'),
  validate(reviewSubmissionSchema),
  async (req, res) => {
    const result = await taskService.reviewSubmission(req.user.id, req.params.submissionId, req.body);
    successResponse(res, result, `Submission ${req.body.status.toLowerCase()}`);
  },
);

// GET /api/v1/tasks/my/created — Poster's tasks
router.get('/my/created', authenticate, authorize('POSTER', 'ADMIN'), async (req, res) => {
  const { page = 1, limit = 20, status } = req.query;
  const { prisma } = require('../config/database');
  const where = { posterId: req.user.id, ...(status && { status }) };
  const [tasks, total] = await Promise.all([
    prisma.task.findMany({ where, skip: (page - 1) * limit, take: parseInt(limit), orderBy: { createdAt: 'desc' }, include: { _count: { select: { submissions: true } } } }),
    prisma.task.count({ where }),
  ]);
  paginatedResponse(res, tasks, paginate(page, limit, total));
});

// GET /api/v1/tasks/my/submissions — Worker's submissions
router.get('/my/submissions', authenticate, authorize('WORKER', 'ADMIN'), async (req, res) => {
  const { page = 1, limit = 20, status } = req.query;
  const { prisma } = require('../config/database');
  const where = { workerId: req.user.id, ...(status && { status }) };
  const [submissions, total] = await Promise.all([
    prisma.taskSubmission.findMany({
      where, skip: (page - 1) * limit, take: parseInt(limit),
      orderBy: { createdAt: 'desc' },
      include: { task: { select: { id: true, title: true, reward: true, currency: true, category: true } } },
    }),
    prisma.taskSubmission.count({ where }),
  ]);
  paginatedResponse(res, submissions, paginate(page, limit, total));
});


// GET /api/v1/tasks/:id/submissions — Poster views submissions for their task
router.get('/:id/submissions', authenticate, authorize('POSTER', 'ADMIN'), async (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  const { prisma } = require('../config/database');
  
  // Verify the task belongs to this poster
  const task = await prisma.task.findUnique({ where: { id: req.params.id }, select: { posterId: true } });
  if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
  if (task.posterId !== req.user.id && req.user.role !== 'ADMIN') {
    return res.status(403).json({ success: false, message: 'Not authorized' });
  }
  
  const [submissions, total] = await Promise.all([
    prisma.taskSubmission.findMany({
      where: { taskId: req.params.id },
      skip: (page - 1) * limit, take: parseInt(limit),
      orderBy: { createdAt: 'desc' },
      include: {
        worker: { select: { id: true, username: true, firstName: true, lastName: true, avatarUrl: true } },
      },
    }),
    prisma.taskSubmission.count({ where: { taskId: req.params.id } }),
  ]);
  
  const { paginatedResponse, paginate } = require('../utils/apiResponse');
  paginatedResponse(res, submissions, paginate(page, limit, total));
});

// GET /api/v1/tasks/:id
router.get('/:id', async (req, res) => {
  const userId = req.headers.authorization ? req.user?.id : null;
  const data = await taskService.getTask(req.params.id, userId);
  successResponse(res, data, 'Task fetched');
});
// PATCH /api/v1/tasks/:id — Update task (poster only)
router.patch('/:id', authenticate, authorize('POSTER', 'ADMIN'), async (req, res) => {
  try {
    const { prisma } = require('../config/database');
    const task = await prisma.task.findUnique({ where: { id: req.params.id }, select: { posterId: true } });
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
    if (task.posterId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    const allowedFields = ['title', 'description', 'status', 'reward', 'currency', 'maxWorkers', 'deadline', 'instructions', 'proofRequired', 'tags', 'category', 'estimatedTime'];
    const updates = {};
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    const updated = await prisma.task.update({
      where: { id: req.params.id },
      data: updates,
    });
    const { successResponse } = require('../utils/apiResponse');
    successResponse(res, updated, 'Task updated');
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/v1/tasks/:id — Delete task (poster only)
router.delete('/:id', authenticate, authorize('POSTER', 'ADMIN'), async (req, res) => {
  try {
    const { prisma } = require('../config/database');
    const task = await prisma.task.findUnique({ where: { id: req.params.id }, select: { posterId: true, status: true } });
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
    if (task.posterId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    await prisma.task.delete({ where: { id: req.params.id } });
    const { successResponse } = require('../utils/apiResponse');
    successResponse(res, null, 'Task deleted');
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
