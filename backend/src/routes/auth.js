const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database/db');
const { authenticate } = require('../middleware/auth');
const { sendPasswordResetCode } = require('../utils/mailer');

const router = express.Router();
const RESET_CODE_EXPIRY_MINUTES = 5;
const RESET_MAX_ATTEMPTS = 2;

function generateSixDigitCode() {
    return String(Math.floor(100000 + Math.random() * 900000));
}

async function getActiveResetRequest(email) {
    return db('password_reset_requests')
        .where({ email, is_used: false })
        .orderBy('created_at', 'desc')
        .first();
}



// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required.' });
        }

        const user = await db('users')
            .join('roles', 'users.role_id', 'roles.id')
            .select(
                'users.id', 'users.first_name', 'users.last_name', 'users.email',
                'users.password_hash', 'users.role_id', 'users.organization_id',
                'users.is_active', 'users.avatar_url',
                'roles.name as role_name', 'roles.side as role_side', 'roles.hierarchy_level'
            )
            .where('users.email', email)
            .first();

        if (!user || !user.is_active) {
            return res.status(401).json({ error: 'This email is not registered' });
        }

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            return res.status(401).json({ error: 'Incorrect password' });
        }

        await db('users').where({ id: user.id }).update({ last_login_at: db.fn.now() });

        const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
            expiresIn: process.env.JWT_EXPIRES_IN || '7d',
        });

        delete user.password_hash;
        res.json({ user, token });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Login failed.' });
    }
});

// ─── Rate-limiting for password reset requests (per email) ───
const resetRequestTracker = new Map(); // email -> { count, firstRequestAt }
const RESET_REQUEST_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_RESET_REQUESTS_PER_WINDOW = 3;

// Clean up stale entries every 30 minutes to prevent memory leak
setInterval(() => {
    const now = Date.now();
    for (const [email, tracker] of resetRequestTracker) {
        if (now - tracker.firstRequestAt > RESET_REQUEST_WINDOW_MS) {
            resetRequestTracker.delete(email);
        }
    }
}, 30 * 60 * 1000);

// POST /api/auth/password-reset/request
router.post('/password-reset/request', async (req, res) => {
    try {
        const email = String(req.body?.email || '').trim().toLowerCase();
        if (!email) return res.status(400).json({ error: 'Email is required.' });

        // ─── Rate-limit check: max N requests per email per window ───
        const now = Date.now();
        const tracker = resetRequestTracker.get(email);
        if (tracker && (now - tracker.firstRequestAt < RESET_REQUEST_WINDOW_MS)) {
            if (tracker.count >= MAX_RESET_REQUESTS_PER_WINDOW) {
                // Return 429 so the frontend knows not to advance to the verify step
                return res.status(429).json({ error: 'Too many requests. Please wait before trying again.' });
            }
            tracker.count++;
        } else {
            resetRequestTracker.set(email, { count: 1, firstRequestAt: now });
        }

        const user = await db('users').whereRaw('LOWER(email) = ?', [email]).where({ is_active: true }).first();
        if (!user) {
            return res.json({ message: 'If this email exists, a verification code has been sent.' });
        }

        const code = generateSixDigitCode();
        const codeHash = await bcrypt.hash(code, 10);
        const expiresAt = new Date(Date.now() + RESET_CODE_EXPIRY_MINUTES * 60 * 1000);

        await db.transaction(async (trx) => {
            await trx('password_reset_requests')
                .whereRaw('LOWER(email) = ?', [email])
                .andWhere({ is_used: false })
                .update({ is_used: true, updated_at: trx.fn.now() });

            await trx('password_reset_requests').insert({
                email,
                code_hash: codeHash,
                expires_at: expiresAt,
                attempt_count: 0,
                max_attempts: RESET_MAX_ATTEMPTS,
                is_used: false,
                is_verified: false,
            });
        });

        try {
            await sendPasswordResetCode(email, code);
        } catch (mailErr) {
            console.error('Password reset mail send error:', mailErr);
            return res.status(500).json({ error: 'We could not send the reset code email. Please try again.' });
        }

        return res.json({ message: 'Verification code sent to your email.' });
    } catch (err) {
        console.error('Password reset request error:', err);
        return res.status(500).json({ error: 'Failed to request password reset.' });
    }
});

// POST /api/auth/password-reset/verify
router.post('/password-reset/verify', async (req, res) => {
    try {
        const email = String(req.body?.email || '').trim().toLowerCase();
        const code = String(req.body?.code || '').trim();

        if (!email || !code) {
            return res.status(400).json({ error: 'Email and code are required.' });
        }
        if (!/^\d{6}$/.test(code)) {
            return res.status(400).json({ error: 'Code must be exactly 6 digits.' });
        }

        const request = await getActiveResetRequest(email);
        if (!request) {
            return res.status(400).json({ error: 'No active reset request found. Please request a new code.' });
        }

        if (new Date(request.expires_at) < new Date()) {
            await db('password_reset_requests').where({ id: request.id }).update({ is_used: true, updated_at: db.fn.now() });
            return res.status(400).json({ error: 'This code has expired. Please request a new code.' });
        }

        if (request.attempt_count >= request.max_attempts) {
            await db('password_reset_requests').where({ id: request.id }).update({ is_used: true, updated_at: db.fn.now() });
            return res.status(400).json({ error: 'Too many incorrect attempts. Please request a new code.' });
        }

        const isMatch = await bcrypt.compare(code, request.code_hash);
        if (!isMatch) {
            await db('password_reset_requests')
                .where({ id: request.id })
                .update({ attempt_count: request.attempt_count + 1, updated_at: db.fn.now() });
            return res.status(400).json({ error: 'Incorrect verification code.' });
        }

        await db('password_reset_requests').where({ id: request.id }).update({ is_verified: true, updated_at: db.fn.now() });
        return res.json({ message: 'Code verified successfully.' });
    } catch (err) {
        console.error('Password reset verify error:', err);
        return res.status(500).json({ error: 'Failed to verify reset code.' });
    }
});

// POST /api/auth/password-reset/confirm
router.post('/password-reset/confirm', async (req, res) => {
    try {
        const email = String(req.body?.email || '').trim().toLowerCase();
        const code = String(req.body?.code || '').trim();
        const newPassword = String(req.body?.new_password || '');

        if (!email || !code || !newPassword) {
            return res.status(400).json({ error: 'Email, code, and new password are required.' });
        }
        if (!/^\d{6}$/.test(code)) {
            return res.status(400).json({ error: 'Code must be exactly 6 digits.' });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'New password must be at least 6 characters.' });
        }

        const user = await db('users').whereRaw('LOWER(email) = ?', [email]).where({ is_active: true }).first();
        if (!user) {
            return res.status(400).json({ error: 'This email is not registered.' });
        }

        const request = await getActiveResetRequest(email);
        if (!request) {
            return res.status(400).json({ error: 'No active reset request found. Please request a new code.' });
        }

        if (new Date(request.expires_at) < new Date()) {
            await db('password_reset_requests').where({ id: request.id }).update({ is_used: true, updated_at: db.fn.now() });
            return res.status(400).json({ error: 'This code has expired. Please request a new code.' });
        }

        if (request.attempt_count >= request.max_attempts) {
            await db('password_reset_requests').where({ id: request.id }).update({ is_used: true, updated_at: db.fn.now() });
            return res.status(400).json({ error: 'Too many incorrect attempts. Please request a new code.' });
        }

        const isMatch = await bcrypt.compare(code, request.code_hash);
        if (!isMatch) {
            await db('password_reset_requests')
                .where({ id: request.id })
                .update({ attempt_count: request.attempt_count + 1, updated_at: db.fn.now() });
            return res.status(400).json({ error: 'Incorrect verification code.' });
        }

        const password_hash = await bcrypt.hash(newPassword, 10);
        await db.transaction(async (trx) => {
            await trx('users').where({ id: user.id }).update({ password_hash, updated_at: trx.fn.now() });
            await trx('password_reset_requests').where({ id: request.id }).update({ is_used: true, updated_at: trx.fn.now() });
        });

        return res.json({ message: 'Password reset successful. Please sign in.' });
    } catch (err) {
        console.error('Password reset confirm error:', err);
        return res.status(500).json({ error: 'Failed to reset password.' });
    }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
    try {
        const permissions = await db('permissions').where({ role_id: req.user.role_id });
        res.json({ user: req.user, permissions });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch user info.' });
    }
});

// PUT /api/auth/password — Change own password
router.put('/password', authenticate, async (req, res) => {
    try {
        const { current_password, new_password } = req.body;
        if (!current_password || !new_password) {
            return res.status(400).json({ error: 'Current password and new password are required.' });
        }
        if (new_password.length < 6) {
            return res.status(400).json({ error: 'New password must be at least 6 characters.' });
        }

        const user = await db('users').where({ id: req.user.id }).first();
        const valid = await bcrypt.compare(current_password, user.password_hash);
        if (!valid) {
            return res.status(401).json({ error: 'Current password is incorrect.' });
        }

        const password_hash = await bcrypt.hash(new_password, 10);
        await db('users').where({ id: req.user.id }).update({ password_hash, updated_at: db.fn.now() });

        res.json({ message: 'Password updated successfully.' });
    } catch (err) {
        console.error('Change password error:', err);
        res.status(500).json({ error: 'Failed to change password.' });
    }
});

module.exports = router;
