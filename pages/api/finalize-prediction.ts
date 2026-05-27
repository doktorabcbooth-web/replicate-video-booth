import type { NextApiRequest, NextApiResponse } from 'next'
import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN || ''

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const { id } = req.body
  if (!id) return res.status(400).json({ error: 'missing id' })

  try {
    const r = await fetch(`https://api.replicate.com/v1/predictions/${id}`, { headers: { Authorization: `Token ${REPLICATE_API_TOKEN}` } })
    const j = await r.json()
    if (j.status !== 'succeeded') return res.status(400).json({ error: 'prediction not completed', status: j.status })

    // get output URL -- support several shapes
    let outputUrl: string | null = null
    if (Array.isArray(j.output) && j.output.length) outputUrl = j.output[0]
    // output may be a string (Runway returns string), or an object with url
    if (!outputUrl && typeof j.output === 'string') outputUrl = j.output
    if (!outputUrl && j.output?.url) outputUrl = j.output.url
    if (!outputUrl && j.result?.url) outputUrl = j.result.url
    if (!outputUrl && j.output && typeof j.output === 'object') {
      // attempt to find a url in nested object
      for (const k of Object.keys(j.output)) {
        const v = (j.output as any)[k]
        if (typeof v === 'string' && v.match(/^https?:\/\/.+\.(mp4|mov|webm)/i)) { outputUrl = v; break }
        if (v && typeof v === 'object' && typeof v.url === 'string') { outputUrl = v.url; break }
      }
    }
    if (!outputUrl) return res.status(500).json({ error: 'no output url found', raw: j })

    // Upload to Cloudinary
    const upload = await cloudinary.uploader.upload(outputUrl, { resource_type: 'video' })
    return res.status(200).json({ ok: true, publicId: upload.public_id, url: upload.secure_url })
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'finalize error' })
  }
}
