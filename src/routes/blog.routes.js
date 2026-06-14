'use strict';

const express = require('express');
const { prisma } = require('../config/database');
const { authenticate } = require('../middleware/auth.middleware');
const { successResponse, createdResponse, ApiError } = require('../utils/apiResponse');

const router = express.Router();

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now();
}

// Public: list published posts
router.get('/', async (req, res) => {
  const { limit, category } = req.query;
  const where = { isPublished: true };
  if (category) where.category = category;
  const posts = await prisma.blogPost.findMany({
    where,
    orderBy: { publishedAt: 'desc' },
    take: limit ? parseInt(limit) : 50,
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
      coverImage: true, tags: true, isPublished: true, publishedAt: true, createdAt: true, viewCount: true,
    },
  });
  successResponse(res, { posts });
});

// Auth: create a post
router.post('/user', authenticate, async (req, res) => {
  const { title, excerpt, content, category, tags, coverImage, status } = req.body;
  if (!title || !content) throw ApiError.badRequest('Title and content are required');
  const slug = slugify(title);
  const post = await prisma.blogPost.create({
    data: {
      authorId: req.user.id,
      title, excerpt, content, slug, category,
      coverImage,
      tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map((t) => t.trim())) : [],
      isPublished: status === 'published',
      publishedAt: status === 'published' ? new Date() : null,
    },
  });
  createdResponse(res, post, 'Post created');
});

// Auth: update own post
router.put('/user/:id', authenticate, async (req, res) => {
  const existing = await prisma.blogPost.findUnique({ where: { id: req.params.id } });
  if (!existing) throw ApiError.notFound('Post not found');
  if (existing.authorId !== req.user.id) throw ApiError.forbidden('Not your post');
  const { title, excerpt, content, category, tags, coverImage, status } = req.body;
  const post = await prisma.blogPost.update({
    where: { id: req.params.id },
    data: {
      title, excerpt, content, category, coverImage,
      tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map((t) => t.trim())) : existing.tags,
      isPublished: status === 'published',
      publishedAt: status === 'published' && !existing.publishedAt ? new Date() : status !== 'published' ? null : existing.publishedAt,
    },
  });
  successResponse(res, post, 'Post updated');
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
    orderBy: { createdAt: 'desc' },
    include: { author: { select: { id: true, firstName: true, lastName: true, username: true, avatarUrl: true } } },
  });
  successResponse(res, { posts });
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
  const { email } = req.body;
  if (!email) throw ApiError.badRequest('Email is required');
  const existing = await prisma.newsletterSubscriber.findUnique({ where: { email } });
  if (existing) return successResponse(res, null, 'Already subscribed');
  await prisma.newsletterSubscriber.create({ data: { email } });
  createdResponse(res, null, 'Subscribed!');
});

module.exports = router;
