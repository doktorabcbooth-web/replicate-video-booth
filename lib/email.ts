// email helper using Resend with nodemailer fallback
import { Resend } from 'resend'
import nodemailer from 'nodemailer'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null

export async function sendEmailWithAttachment(to: string, subject: string, text: string, attachmentPath?: string) {
  if (resend) {
    return resend.emails.send({
      from: process.env.EMAIL_FROM || 'no-reply@example.com',
      to,
      subject,
      text,
    })
  }

  // Fallback to nodemailer (requires SMTP env vars)
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
  return transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    text,
  })
}
