import type { NextApiRequest, NextApiResponse } from 'next'
import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const { url } = req.body
  if (!url) return res.status(400).json({ error: 'missing url' })

  try {
    const upload = await cloudinary.uploader.upload(url, { resource_type: 'video' })
    return res.status(200).json({ ok: true, publicId: upload.public_id, url: upload.secure_url })
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'upload error' })
  }
}
