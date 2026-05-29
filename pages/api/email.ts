import type { NextApiRequest, NextApiResponse } from 'next'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY || '')

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const { to, videoUrl } = req.body
  if (!to || !videoUrl) return res.status(400).json({ error: 'missing to or videoUrl' })

  try {
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>DoctorABC World Cup Star</title>
          <style>
            body { font-family: 'Poppins', Helvetica, Arial, sans-serif; background-color: #E7FCF7; color: #0D2C54; padding: 20px; margin: 0; }
            .email-container { max-width: 500px; margin: 0 auto; background: #ffffff; border-radius: 30px; padding: 30px; box-shadow: 0 10px 30px rgba(13,44,84,0.06); border: 1px solid rgba(13, 44, 84, 0.08); text-align: center; }
            .logo-header { display: inline-flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 25px; padding: 10px 18px; border-radius: 999px; background: #EEF1F6; }
            .logo-header img { width: 38px; height: 38px; object-fit: contain; }
            .logo-text { font-weight: 700; font-size: 16px; color: #0D2C54; letter-spacing: 0.5px; }
            h1 { font-size: 22px; font-weight: 700; color: #0D2C54; line-height: 1.4; margin: 0 0 20px 0; }
            .video-preview { border-radius: 12px; overflow: hidden; margin: 25px 0; border: 1px solid rgba(13, 44, 84, 0.1); background: #000; display: block; position: relative; }
            .video-preview img { width: 100%; display: block; }
            .btn { display: inline-block; min-height: 48px; line-height: 48px; padding: 0 35px; border-radius: 6px; background: linear-gradient(135deg, #29C7A1, #11DDAC); color: #0D2C54; font-weight: 700; font-size: 14px; text-decoration: none; box-shadow: 0 4px 15px rgba(41, 199, 161, 0.3); transition: transform 0.12s ease; margin-top: 10px; }
            .footer { margin-top: 30px; font-size: 11px; color: rgba(13, 44, 84, 0.5); }
          </style>
        </head>
        <body>
          <div class="email-container">
            <div class="logo-header">
              <img src="https://res.cloudinary.com/do4hqtjxb/image/upload/v1780067385/doktorabc-logo_uwqswp.svg" alt="DoctorABC Logo">
              <span class="logo-text">DoctorABC</span>
            </div>
            <h1>Be the star of the world cup and share the goal you scored with DoctorABC!</h1>
            <div class="video-preview">
              <a href="${videoUrl}">
                <!-- Using a high-quality sports pitch background thumbnail since video can't autoplay inside mail client -->
                <img src="https://res.cloudinary.com/do4hqtjxb/image/upload/v1779910689/Icon_uu7a2w.png" alt="Your Football Video Goal" style="max-height: 220px; object-fit: contain; background: #000; margin: 0 auto;">
              </a>
            </div>
            <a href="${videoUrl}" class="btn">Get your video</a>
            <div class="footer">
              &copy; ${new Date().getFullYear()} DoctorABC. All rights reserved.
            </div>
          </div>
        </body>
      </html>
    `

    const r = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'noreply@example.com',
      to,
      subject: 'Start your journey to a better health',
      html: emailHtml,
    })
    res.status(200).json({ ok: true, result: r })
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'email error' })
  }
}
