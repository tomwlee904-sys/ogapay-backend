'use strict';

const express = require('express');
const multer = require('multer');
const { authenticate, authorize, requireKyc, optionalAuth } = require('../middleware/auth.middleware');
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

// POST /api/v1/tasks/:id/submit — Worker submits proof (attachments as ImageKit URLs)
router.post(
  '/:id/submit',
  authenticate,
  authorize('WORKER', 'ADMIN'),
  validate(submitTaskSchema),
  async (req, res) => {
    const attachments = Array.isArray(req.body?.attachments) ? req.body.attachments : [];
    const submission = await taskService.submitTask(req.user.id, req.params.id, {
      ...req.body,
      attachments,
    });
    successResponse(res, submission, 'Submission sent for review');
  },
);

// PATCH /api/v1/tasks/submissions/:submissionId/review — Poster approves/rejects
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

// PATCH /api/v1/tasks/submissions/:submissionId/reject — Poster rejects + reopens slot
router.patch(
  '/submissions/:submissionId/reject',
  authenticate,
  authorize('POSTER', 'ADMIN'),
  async (req, res) => {
    const result = await taskService.rejectSubmission(req.user.id, req.params.submissionId, req.body);
    successResponse(res, result, 'Submission rejected, slot reopened');
  },
);

// POST /api/v1/tasks/:id/submissions/:submissionId/approve — Approve submission
router.post(
  '/:id/submissions/:submissionId/approve',
  authenticate,
  authorize('POSTER', 'ADMIN'),
  async (req, res) => {
    const taskService = require('../services/task.service');
    const result = await taskService.reviewSubmission(req.user.id, req.params.submissionId, { status: 'APPROVED' });
    successResponse(res, result, 'Submission approved');
  },
);

// POST /api/v1/tasks/:id/submissions/:submissionId/reject — Reject submission
router.post(
  '/:id/submissions/:submissionId/reject',
  authenticate,
  authorize('POSTER', 'ADMIN'),
  async (req, res) => {
    const taskService = require('../services/task.service');
    const result = await taskService.rejectSubmission(req.user.id, req.params.submissionId, req.body);
    successResponse(res, result, 'Submission rejected');
  },
);

// GET /api/v1/tasks/my/created — Poster's tasks
router.get('/my/created', authenticate, async (req, res) => {
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
router.get('/my/submissions', authenticate, async (req, res) => {
  const { prisma } = require('../config/database');
  const submissions = await prisma.taskSubmission.findMany({
    where: { workerId: req.user.id },
    include: {
      task: {
        select: { id: true, title: true, description: true, reward: true, currency: true, category: true, status: true,
          poster: { select: { username: true, avatarUrl: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  const active = submissions.filter(s => s.status === 'PENDING');
  const completed = submissions.filter(s => s.status === 'APPROVED');
  const rejected = submissions.filter(s => s.status === 'REJECTED');
  const { successResponse } = require('../utils/apiResponse');
  successResponse(res, {
    submissions,
    buckets: { active, completed, rejected },
    stats: {
      totalEarned: completed.reduce((sum, s) => sum + Number(s.task?.reward || 0), 0),
      totalCompleted: completed.length,
      totalPending: active.length,
    },
  });
});


// GET /api/v1/tasks/:id/submissions — Poster views submissions for their task
router.get('/:id/submissions', authenticate, async (req, res) => {
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

// GET /api/v1/tasks/featured — Featured tasks
router.get('/featured', async (req, res) => {
  const tasks = await taskService.getFeaturedTasks();
  successResponse(res, tasks, 'Featured tasks fetched');
});

// POST /api/v1/tasks/:id/waitlist — Join cooldown waitlist
router.post(
  '/:id/waitlist',
  authenticate,
  authorize('WORKER', 'ADMIN'),
  async (req, res) => {
    const result = await taskService.joinWaitlist(req.user.id, req.params.id);
    createdResponse(res, result, `You are number ${result.position} on the waitlist`);
  },
);

// PATCH /api/v1/tasks/:id/feature — Admin feature/unfeature a task
router.patch(
  '/:id/feature',
  authenticate,
  authorize('ADMIN'),
  async (req, res) => {
    const { prisma } = require('../config/database');
    await prisma.task.update({
      where: { id: req.params.id },
      data: { featured: req.body.featured ?? true },
    });
    successResponse(res, null, `Task ${req.body.featured ? 'featured' : 'unfeatured'}`);
  },
);

// GET /api/v1/tasks/:id
router.get('/:id', optionalAuth, async (req, res) => {
  const userId = req.user?.id || null;
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
