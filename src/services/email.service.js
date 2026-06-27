'use strict';

const { logger } = require('../utils/logger');

const RESEND_API_KEY = process.env.RESEND_API_KEY;

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

async function sendViaResend({ to, subject, html }) {
  const axios = require('axios');
  const res = await axios.post('https://api.resend.com/emails', {
    from: process.env.EMAIL_FROM || 'OgaPay <noreply@ogapay.io>',
    to,
    subject,
    html,
  }, {
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });
  return { sent: true, id: res.data?.id };
}

async function sendViaSMTP({ to, subject, html }) {
  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  const info = await transporter.sendMail({
    from: process.env.EMAIL_FROM || 'OgaPay <noreply@ogapay.io>',
    to,
    subject,
    html,
  });
  return { sent: true, id: info.messageId };
}

async function sendEmail({ to, subject, html }) {
  if (RESEND_API_KEY && RESEND_API_KEY !== 're_your_resend_api_key') {
    try {
      return await sendViaResend({ to, subject, html });
    } catch (err) {
      logger.warn(`Resend failed for ${to}: ${err.response?.data?.message || err.message}`);
    }
  }

  if (SMTP_HOST && SMTP_USER) {
    try {
      return await sendViaSMTP({ to, subject, html });
    } catch (err) {
      logger.warn(`SMTP fallback failed for ${to}: ${err.message}`);
    }
  }

  logger.info(`FALLBACK — verification link for ${to}:\n${extractLink(html)}`);
  return { sent: false, fallback: true };
}

function extractLink(html) {
  const m = html.match(/https?:\/\/[^\s"']+/);
  return m ? m[0] : '(link could not be extracted)';
}

function buildVerificationEmail({ name, link }) {
  return {
    subject: 'Verify your email — OgaPay',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <div style="font-size:28px;font-weight:900;margin-bottom:8px">OgaPay</div>
        <p style="font-size:14px;color:#555;margin:0 0 20px">Hi ${name || 'there'},</p>
        <p style="font-size:14px;color:#555;margin:0 0 20px">Click the button below to verify your email address.</p>
        <a href="${link}" style="display:inline-block;padding:12px 28px;border-radius:8px;background:#191C6D;color:#fff;text-decoration:none;font-weight:700;font-size:14px">Verify Email</a>
        <p style="font-size:12px;color:#999;margin-top:24px">Or paste this link in your browser:<br/>${link}</p>
      </div>
    `,
  };
}

function buildPasswordResetEmail({ name, link }) {
  return {
    subject: 'Reset your password — OgaPay',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <div style="font-size:28px;font-weight:900;margin-bottom:8px">OgaPay</div>
        <p style="font-size:14px;color:#555;margin:0 0 20px">Hi ${name || 'there'},</p>
        <p style="font-size:14px;color:#555;margin:0 0 20px">Click the button below to reset your password. This link expires in 1 hour.</p>
        <a href="${link}" style="display:inline-block;padding:12px 28px;border-radius:8px;background:#191C6D;color:#fff;text-decoration:none;font-weight:700;font-size:14px">Reset Password</a>
        <p style="font-size:12px;color:#999;margin-top:24px">If you didn't request this, you can ignore this email.</p>
        <p style="font-size:12px;color:#999;margin-top:8px">Or paste this link in your browser:<br/>${link}</p>
      </div>
    `,
  };
}

module.exports = { sendEmail, buildVerificationEmail, buildPasswordResetEmail };
