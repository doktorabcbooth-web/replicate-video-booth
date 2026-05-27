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
  const { imageUrl, prompt, template } = req.body
  if (!imageUrl) return res.status(400).json({ error: 'missing imageUrl' })

  // prompt is required for text->video models
  if (!prompt) return res.status(400).json({ error: 'missing prompt' })

  try {
    // Resolve model id/version from either env var name the project may have set.
    const configuredModel = (process.env.REPLICATE_MODEL_ID || process.env.REPLICATE_MODEL_VERSION || '').toLowerCase()

  // If using the free minimax model, use its simpler REST call and output handling
  if (configuredModel.includes('minimax/video-01')) {
      const resp = await fetch('https://api.replicate.com/v1/predictions', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${REPLICATE_API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'minimax/video-01',
          input: { prompt, prompt_optimizer: true }
        })
      })
  const prediction = await resp.json()
      // poll until completed
      const finished = await pollPrediction(`https://api.replicate.com/v1/predictions/${prediction.id}`)
      // minimax returns an output with a url accessor or direct url
      const outputUrl = finished?.output?.[0] || finished?.output || (finished?.result?.url ? finished.result.url : null)
      if (!outputUrl) return res.status(500).json({ error: 'no output from minimax model' })
      const upload = await cloudinary.uploader.upload(outputUrl, { resource_type: 'video' })
      return res.status(200).json({ ok: true, cloudinaryPublicId: upload.public_id, url: upload.secure_url })
    }

    // If configured to use Runway Gen-4 (or other runway variants), prefer the runway input shape.
    // Assumption: when using Runway Gen-4 you set REPLICATE_MODEL_ID=runwayml/gen-4 or REPLICATE_MODEL_VERSION to the runway version id.
    if (configuredModel.includes('runway') || configuredModel.includes('gen-4')) {
      const response = await fetch('https://api.replicate.com/v1/predictions', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${REPLICATE_API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          // For Runway models Replicate often expects a version id; allow REPLICATE_MODEL_VERSION to contain that.
          version: process.env.REPLICATE_MODEL_VERSION || process.env.REPLICATE_MODEL_ID,
          input: {
            // Use the same key name you used in the UI: first_frame_image
            first_frame_image: imageUrl,
            prompt,
            template
          }
        })
      })
      const data = await response.json()

      // Poll until result ready
      const result = await pollPrediction(`https://api.replicate.com/v1/predictions/${data.id}`)

      const outputUrl = Array.isArray(result.output) ? result.output[0] : result.output
      if (!outputUrl) return res.status(500).json({ error: 'no output from model' })

      const upload = await cloudinary.uploader.upload(outputUrl, { resource_type: 'video' })
      res.status(200).json({ ok: true, cloudinaryPublicId: upload.public_id, url: upload.secure_url })
      return
    }

    // Default path: version-based models (non-Runway)
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
          prompt,
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
