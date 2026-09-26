'use strict';

const express = require('express');
const { prisma } = require('../config/database');
const { authenticate } = require('../middleware/auth.middleware');
const { successResponse, createdResponse, ApiError } = require('../utils/apiResponse');
const { validate, blogPostSchema } = require('../middleware/validate');

const router = express.Router();

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) + '-' + Date.now();
}

// Draft, waiting for review, or live
const postStatus = (p) => (p.isPublished ? 'PUBLISHED' : p.submittedAt ? 'PENDING' : 'DRAFT');

// Public: list published posts
router.get('/', async (req, res) => {
  const { category } = req.query;
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
  const where = { isPublished: true };
  if (typeof category === 'string' && category.length <= 40) where.category = category;
  const posts = await prisma.blogPost.findMany({
    where,
    orderBy: { publishedAt: 'desc' },
    take: limit,
    select: {
      id: true, title: true, excerpt: true, slug: true, category: true,
      coverImage: true, tags: true, publishedAt: true, createdAt: true, viewCount: true,
      author: { select: { id: true, firstName: true, lastName: true, username: true, avatarUrl: true } },
    },
  });
  successResponse(res, { posts });
});

// Public: get single post by slug
router.get('/:slug', async (req, res) => {
  const post = await prisma.blogPost.findUnique({
    where: { slug: req.params.slug },
    include: { author: { select: { id: true, firstName: true, lastName: true, username: true, avatarUrl: true } } },
  });
  if (!post || !post.isPublished) return res.status(404).json({ success: false, message: 'Post not found' });
  // Increment view count (fire-and-forget)
  prisma.blogPost.update({ where: { id: post.id }, data: { viewCount: { increment: 1 } } }).catch(() => {});
  successResponse(res, post);
});

// Auth: get my posts
router.get('/user/mine', authenticate, async (req, res) => {
  const posts = await prisma.blogPost.findMany({
    where: { authorId: req.user.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, title: true, excerpt: true, slug: true, category: true,
      coverImage: true, tags: true, isPublished: true, publishedAt: true, submittedAt: true, createdAt: true, viewCount: true,
    },
  });
  successResponse(res, { posts: posts.map((p) => ({ ...p, status: postStatus(p) })) });
});

// Auth: get one of my posts to edit (drafts included)
router.get('/user/:id', authenticate, async (req, res) => {
  const post = await prisma.blogPost.findUnique({ where: { id: req.params.id } });
  if (!post || post.authorId !== req.user.id) throw ApiError.notFound('Post not found');
  successResponse(res, { ...post, status: postStatus(post) });
});

// Users' posts go to an admin for review before they appear on the public blog,
// so nobody can publish under OgaPay's name straight away. "published" here means
// "send for review"; admins publish directly.
const reviewFields = (req, status) => {
  const isAdmin = req.user.role === 'ADMIN';
  if (status !== 'published') return { isPublished: false, publishedAt: null, submittedAt: null };
  if (isAdmin) return { isPublished: true, publishedAt: new Date(), submittedAt: null };
  return { isPublished: false, publishedAt: null, submittedAt: new Date() };
};

// Auth: create a post
router.post('/user', authenticate, validate(blogPostSchema), async (req, res) => {
  const { title, excerpt, content, category, tags, coverImage, status } = req.body;
  const post = await prisma.blogPost.create({
    data: {
      authorId: req.user.id,
      title, excerpt, content, slug: slugify(title), category,
      coverImage,
      tags: tags || [],
      ...reviewFields(req, status),
    },
  });
  const message = post.isPublished ? 'Post published' : post.submittedAt ? 'Sent for review' : 'Draft saved';
  createdResponse(res, { ...post, status: postStatus(post) }, message);
});

// Auth: update own post. Editing a live post sends it back for review.
router.put('/user/:id', authenticate, validate(blogPostSchema), async (req, res) => {
  const existing = await prisma.blogPost.findUnique({ where: { id: req.params.id } });
  if (!existing) throw ApiError.notFound('Post not found');
  if (existing.authorId !== req.user.id) throw ApiError.forbidden('Not your post');
  const { title, excerpt, content, category, tags, coverImage, status } = req.body;
  const fields = reviewFields(req, status);
  // An admin re-saving a live post keeps its original publish date
  if (fields.isPublished && existing.publishedAt) fields.publishedAt = existing.publishedAt;
  const post = await prisma.blogPost.update({
    where: { id: req.params.id },
    data: {
      title, excerpt, content, category, coverImage,
      tags: tags || existing.tags,
      ...fields,
    },
  });
  const message = post.isPublished ? 'Post updated' : post.submittedAt ? 'Sent for review' : 'Draft saved';
  successResponse(res, { ...post, status: postStatus(post) }, message);
});

// Auth: delete own post
router.delete('/user/:id', authenticate, async (req, res) => {
  const existing = await prisma.blogPost.findUnique({ where: { id: req.params.id } });
  if (!existing) throw ApiError.notFound('Post not found');
  if (existing.authorId !== req.user.id) throw ApiError.forbidden('Not your post');
  await prisma.blogPost.delete({ where: { id: req.params.id } });
  successResponse(res, null, 'Post deleted');
});

// Admin: get all posts
router.get('/admin/all', authenticate, async (req, res) => {
  if (req.user.role !== 'ADMIN') throw ApiError.forbidden('Admin only');
  const posts = await prisma.blogPost.findMany({
    orderBy: [{ submittedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
    include: { author: { select: { id: true, firstName: true, lastName: true, username: true, avatarUrl: true } } },
  });
  successResponse(res, { posts: posts.map((p) => ({ ...p, status: postStatus(p) })) });
});

// Admin: create/edit/delete (admin override)
router.post('/', authenticate, async (req, res) => {
  if (req.user.role !== 'ADMIN') throw ApiError.forbidden('Admin only');
  const { title, excerpt, content, category, tags, coverImage, status } = req.body;
  const slug = slugify(title);
  const post = await prisma.blogPost.create({
    data: {
      authorId: req.user.id,
      title, excerpt, content, slug, category,
      coverImage,
      tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map((t) => t.trim())) : [],
      isPublished: status === 'PUBLISHED',
      publishedAt: status === 'PUBLISHED' ? new Date() : null,
    },
  });
  createdResponse(res, post, 'Post created');
});

router.put('/:id', authenticate, async (req, res) => {
  if (req.user.role !== 'ADMIN') throw ApiError.forbidden('Admin only');
  const { title, excerpt, content, category, tags, coverImage, status } = req.body;
  const existing = await prisma.blogPost.findUnique({ where: { id: req.params.id } });
  if (!existing) throw ApiError.notFound('Post not found');
  const post = await prisma.blogPost.update({
    where: { id: req.params.id },
    data: {
      title, excerpt, content, category, coverImage,
      tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map((t) => t.trim())) : existing.tags,
      isPublished: status === 'PUBLISHED',
      publishedAt: status === 'PUBLISHED' && !existing.publishedAt ? new Date() : status === 'DRAFT' ? null : existing.publishedAt,
      // Publishing or rejecting a post takes it out of the review queue
      submittedAt: status === 'PUBLISHED' || status === 'DRAFT' ? null : existing.submittedAt,
    },
  });
  successResponse(res, post, 'Post updated');
});

router.delete('/:id', authenticate, async (req, res) => {
  if (req.user.role !== 'ADMIN') throw ApiError.forbidden('Admin only');
  await prisma.blogPost.delete({ where: { id: req.params.id } });
  successResponse(res, null, 'Post deleted');
});

// Newsletter: subscribe
router.post('/newsletter/subscribe', async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw ApiError.badRequest('Enter a valid email address');
  const existing = await prisma.newsletterSubscriber.findUnique({ where: { email } });
  if (existing) return successResponse(res, null, 'Already subscribed');
  await prisma.newsletterSubscriber.create({ data: { email } });
  createdResponse(res, null, 'Subscribed!');
});

module.exports = router;
