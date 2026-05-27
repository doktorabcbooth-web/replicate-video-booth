import sgMail from '@sendgrid/mail'
import nodemailer from 'nodemailer'

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY
if (SENDGRID_API_KEY) sgMail.setApiKey(SENDGRID_API_KEY)

export async function sendEmailWithAttachment(to: string, subject: string, text: string, attachmentPath?: string) {
  if (SENDGRID_API_KEY) {
    const msg: any = {
      to,
      from: process.env.EMAIL_FROM,
      subject,
      text,
      // TODO: attach file as base64 if attachmentPath provided
    }
    return sgMail.send(msg)
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
