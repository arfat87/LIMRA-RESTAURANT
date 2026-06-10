import nodemailer from 'nodemailer';
import { logger } from './logger';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false, // TLS
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Send an email via Gmail SMTP
 */
export const sendEmail = async (options: EmailOptions): Promise<void> => {
  const mailOptions = {
    from: `"${process.env.STORE_NAME || 'DSLR WORLD'}" <${process.env.SMTP_USER}>`,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    logger.info(`📧 Email sent to ${options.to}: ${info.messageId}`);
  } catch (error) {
    logger.error('❌ Email send failed:', error);
    throw new Error('Failed to send email. Please try again later.');
  }
};

// ─── Email Templates ──────────────────────────────────────────────────────────

const baseTemplate = (title: string, content: string): string => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 30px; text-align: center; }
    .header h1 { color: #e94560; margin: 0; font-size: 28px; letter-spacing: 2px; }
    .header p { color: #aaa; margin: 5px 0 0; font-size: 13px; }
    .body { padding: 40px 30px; color: #333; line-height: 1.7; }
    .cta-button { display: inline-block; margin: 20px 0; padding: 14px 32px; background: linear-gradient(135deg, #e94560, #c73652); color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; }
    .otp-box { background: #f0f0f0; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
    .otp-code { font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #1a1a2e; }
    .footer { background: #f8f8f8; padding: 20px; text-align: center; font-size: 12px; color: #888; border-top: 1px solid #eee; }
    .footer a { color: #e94560; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📷 DSLR WORLD</h1>
      <p>डीएसएलआर वर्ल्ड — Ranchi, Jharkhand</p>
    </div>
    <div class="body">
      ${content}
    </div>
    <div class="footer">
      <p>${process.env.STORE_ADDRESS || 'RR Plaza, Church Rd, Ranchi, Jharkhand 834001'}</p>
      <p>📞 ${process.env.STORE_PHONE || '062023 81019'} | <a href="mailto:${process.env.STORE_EMAIL || 'info@dslrworld.in'}">${process.env.STORE_EMAIL || 'info@dslrworld.in'}</a></p>
      <p style="margin-top: 10px; color: #bbb;">© ${new Date().getFullYear()} DSLR WORLD. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`;

export const welcomeEmailTemplate = (name: string): string =>
  baseTemplate(
    'Welcome to DSLR WORLD!',
    `
    <h2>Welcome, ${name}! 📷</h2>
    <p>Thank you for joining DSLR WORLD — Ranchi's #1 camera store. We're thrilled to have you as a valued member!</p>
    <p>Explore our wide range of:</p>
    <ul>
      <li>🎥 New & Second-Hand DSLR Cameras</li>
      <li>🔭 Professional Lenses & Accessories</li>
      <li>⚡ Action Cameras & Gadgets</li>
    </ul>
    <p>With pan-India delivery and guaranteed lowest prices in Ranchi, we've got you covered.</p>
    <p>Happy clicking! 📸</p>
    `
  );

export const passwordResetEmailTemplate = (name: string, resetUrl: string): string =>
  baseTemplate(
    'Password Reset Request — DSLR WORLD',
    `
    <h2>Reset Your Password</h2>
    <p>Hi ${name},</p>
    <p>We received a request to reset your DSLR WORLD account password. Click the button below to create a new password:</p>
    <div style="text-align: center;">
      <a href="${resetUrl}" class="cta-button">Reset Password</a>
    </div>
    <p style="font-size: 13px; color: #888;">This link expires in <strong>10 minutes</strong>. If you didn't request a password reset, you can safely ignore this email.</p>
    <p style="font-size: 13px; color: #888;">Or copy-paste this URL: <br/><span style="word-break: break-all;">${resetUrl}</span></p>
    `
  );

export const orderConfirmationEmailTemplate = (
  name: string,
  orderId: string,
  totalAmount: number
): string =>
  baseTemplate(
    'Order Confirmed — DSLR WORLD',
    `
    <h2>Order Confirmed! 🎉</h2>
    <p>Hi ${name},</p>
    <p>Your order has been placed successfully at DSLR WORLD.</p>
    <div style="background: #f8f8f8; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <p><strong>Order ID:</strong> ${orderId}</p>
      <p><strong>Total Amount:</strong> ₹${(totalAmount / 100).toLocaleString('en-IN')}</p>
      <p><strong>Status:</strong> Confirmed</p>
    </div>
    <p>You'll receive a shipping notification once your order is dispatched. Expected delivery: 3-7 business days.</p>
    <p>For any queries, contact us at ${process.env.STORE_PHONE || '062023 81019'}.</p>
    `
  );
