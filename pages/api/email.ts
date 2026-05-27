import type { NextApiRequest, NextApiResponse } from 'next'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY || '')

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const { to, videoUrl } = req.body
  if (!to || !videoUrl) return res.status(400).json({ error: 'missing to or videoUrl' })

  try {
    const r = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'noreply@example.com',
      to,
      subject: 'Your event video is ready',
      html: `<p>Your video is ready — <a href="${videoUrl}">click to view</a></p>`,
    })
    res.status(200).json({ ok: true, result: r })
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'email error' })
  }
}
