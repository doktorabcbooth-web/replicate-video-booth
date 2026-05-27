import type { NextApiRequest, NextApiResponse } from 'next'

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN || ''
import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

async function pollPrediction(predictUrl: string) {
  while (true) {
    const r = await fetch(predictUrl, { headers: { Authorization: `Token ${REPLICATE_API_TOKEN}` } })
    const j = await r.json()
    if (j.status === 'succeeded') return j
    if (j.status === 'failed') throw new Error('prediction failed')
    await new Promise((r2) => setTimeout(r2, 3000))
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const { imageUrl, referenceVideoUrl, template } = req.body
  if (!imageUrl) return res.status(400).json({ error: 'missing imageUrl' })

  try {
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        version: process.env.REPLICATE_MODEL_VERSION || 'RUNWAY_GEN4_TURBO_VERSION',
        input: {
          image: imageUrl,
          reference_video: referenceVideoUrl,
          template
        }
      })
    })
    const data = await response.json()

    // Poll until result ready
    const result = await pollPrediction(`https://api.replicate.com/v1/predictions/${data.id}`)

    // Expect result.output to contain URLs; pick first and upload to Cloudinary
    const outputUrl = Array.isArray(result.output) ? result.output[0] : result.output
    if (!outputUrl) return res.status(500).json({ error: 'no output from model' })

    // Upload result video to Cloudinary by providing the remote URL
    const upload = await cloudinary.uploader.upload(outputUrl, { resource_type: 'video' })

    res.status(200).json({ ok: true, cloudinaryPublicId: upload.public_id, url: upload.secure_url })
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'replicate error' })
  }
}
