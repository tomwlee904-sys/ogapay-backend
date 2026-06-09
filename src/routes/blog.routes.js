'use strict';

const express = require('express');
const { prisma } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { successResponse } = require('../utils/apiResponse');

const router = express.Router();

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now();
}

router.get('/admin/all', authenticate, authorize('ADMIN'), async (req, res) => {
  const posts = await prisma.blogPost.findMany({
    orderBy: { createdAt: 'desc' },
    include: { author: { select: { id: true, firstName: true, lastName: true, username: true, avatarUrl: true } } },
  });
  successResponse(res, { posts });
});

router.post('/', authenticate, authorize('ADMIN'), async (req, res) => {
  const { title, excerpt, content, category, tags, coverImage, coverColor, status } = req.body;
  const slug = slugify(title);
  const post = await prisma.blogPost.create({
    data: {
      authorId: req.user.id,
      title, excerpt, content, slug, coverImage,
      tags: tags ? tags.split(',').map(t => t.trim()) : [],
      isPublished: status === 'PUBLISHED',
      publishedAt: status === 'PUBLISHED' ? new Date() : null,
    },
  });
  successResponse(res, post);
});

router.put('/:id', authenticate, authorize('ADMIN'), async (req, res) => {
  const { title, excerpt, content, category, tags, coverImage, coverColor, status } = req.body;
  const existing = await prisma.blogPost.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ success: false, message: 'Post not found' });

  const post = await prisma.blogPost.update({
    where: { id: req.params.id },
    data: {
      title, excerpt, content, coverImage,
      tags: tags ? tags.split(',').map(t => t.trim()) : existing.tags,
      isPublished: status === 'PUBLISHED',
      publishedAt: status === 'PUBLISHED' && !existing.publishedAt ? new Date() : status === 'DRAFT' ? null : existing.publishedAt,
    },
  });
  successResponse(res, post);
});

router.delete('/:id', authenticate, authorize('ADMIN'), async (req, res) => {
  await prisma.blogPost.delete({ where: { id: req.params.id } });
  successResponse(res, null, 'Post deleted');
});

router.get('/public', async (req, res) => {
  const posts = await prisma.blogPost.findMany({
    where: { isPublished: true },
    orderBy: { publishedAt: 'desc' },
    select: { id: true, title: true, excerpt: true, slug: true, coverImage: true, tags: true, publishedAt: true, createdAt: true,
      author: { select: { id: true, firstName: true, lastName: true, username: true, avatarUrl: true } },
    },
  });
  successResponse(res, { posts });
});

router.get('/public/:slug', async (req, res) => {
  const post = await prisma.blogPost.findUnique({
    where: { slug: req.params.slug },
    include: { author: { select: { id: true, firstName: true, lastName: true, username: true, avatarUrl: true } } },
  });
  if (!post || !post.isPublished) return res.status(404).json({ success: false, message: 'Post not found' });
  successResponse(res, post);
});

module.exports = router;
