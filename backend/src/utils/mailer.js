function getTransporter() {
    // Lazy-load to avoid breaking server startup/login if dependency is missing.
    // Password reset endpoints will return a clear error instead.
    let nodemailer;
    try {
        // eslint-disable-next-line global-require
        nodemailer = require('nodemailer');
    } catch (err) {
        throw new Error('Email dependency not installed. Run npm install in backend.');
    }

    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !user || !pass) {
        throw new Error('SMTP is not configured. Please set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS.');
    }

    return nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
    });
}

async function sendViaResend(email, code) {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.MAIL_FROM;

    if (!apiKey) {
        throw new Error('RESEND_API_KEY is not configured.');
    }
    if (!from) {
        throw new Error('MAIL_FROM is not configured.');
    }

    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            from,
            to: [email],
            subject: 'GovernX Password Reset Code',
            text: `Your GovernX password reset code is ${code}. This code expires in 5 minutes. If you did not request this reset, you can ignore this email.`,
        }),
    });

    if (!response.ok) {
        let detail = 'Unknown provider error';
        try {
            const data = await response.json();
            detail = data?.message || JSON.stringify(data);
        } catch (err) {
            detail = await response.text();
        }
        throw new Error(`Resend send failed: ${detail}`);
    }
}

async function sendPasswordResetCode(email, code) {
    // Prefer Resend API if configured (recommended for domain sender identities like aiintern@faberinfinite.com).
    if (process.env.RESEND_API_KEY) {
        await sendViaResend(email, code);
        return;
    }

    const transporter = getTransporter();
    const fromEmail = process.env.MAIL_FROM || process.env.SMTP_USER;
    const from = `"GovernX Support" <${fromEmail}>`;
    const subject = 'Your GovernX Password Reset Code';
    
    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 5px;">
        <h2 style="color: #333; text-align: center;">Password Reset Request</h2>
        <p style="color: #555; font-size: 16px;">Hello,</p>
        <p style="color: #555; font-size: 16px;">We received a request to reset your password for your GovernX account. Please use the verification code below to proceed:</p>
        <div style="text-align: center; margin: 30px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #0056b3; background-color: #f4f8ff; padding: 10px 20px; border-radius: 8px;">${code}</span>
        </div>
        <p style="color: #555; font-size: 16px;">This code will expire in <strong>5 minutes</strong>.</p>
        <p style="color: #555; font-size: 16px;">If you did not request a password reset, please ignore this email or contact support if you have concerns.</p>
        <hr style="border: none; border-top: 1px solid #eaeaea; margin: 20px 0;" />
        <p style="color: #999; font-size: 12px; text-align: center;">This is an automated message, please do not reply to this email.</p>
    </div>
    `;
    
    const text = `Your GovernX password reset code is ${code}. This code expires in 5 minutes. If you did not request this reset, you can ignore this email.`;

    await transporter.sendMail({
        from,
        to: email,
        subject,
        text, // Fallback for email clients that don't support HTML
        html,
    });
}

module.exports = { sendPasswordResetCode };
