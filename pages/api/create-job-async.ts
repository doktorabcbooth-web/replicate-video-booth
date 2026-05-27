import type { NextApiRequest, NextApiResponse } from 'next'

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN || ''

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const { imageUrl, prompt, duration } = req.body
  if (!imageUrl || !prompt) return res.status(400).json({ error: 'missing imageUrl or prompt' })

  try {
    const configuredModel = (process.env.REPLICATE_MODEL_ID || process.env.REPLICATE_MODEL_VERSION || '').toLowerCase()

    // minimax branch
    if (configuredModel.includes('minimax/video-01')) {
      const resp = await fetch('https://api.replicate.com/v1/predictions', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${REPLICATE_API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ model: 'minimax/video-01', input: { prompt, prompt_optimizer: true } })
      })
      const j = await resp.json()
      return res.status(200).json({ ok: true, id: j.id, raw: j })
    }

    // Runway / Gen-4 branch: use first_frame_image like the UI
    if (configuredModel.includes('runway') || configuredModel.includes('gen-4')) {
      // Include duration if provided; try multiple commonly accepted keys
      const input: any = { first_frame_image: imageUrl, prompt }
      if (duration) {
        input.duration = duration
        input.seconds = duration
        input.length = duration
      }
      const resp = await fetch('https://api.replicate.com/v1/predictions', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${REPLICATE_API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ version: process.env.REPLICATE_MODEL_VERSION || process.env.REPLICATE_MODEL_ID, input })
      })
      const j = await resp.json()
      return res.status(200).json({ ok: true, id: j.id, raw: j })
    }

    // Default: version-based call with image key
    const resp = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ version: process.env.REPLICATE_MODEL_VERSION, input: { image: imageUrl, prompt } })
    })
    const j = await resp.json()
    return res.status(200).json({ ok: true, id: j.id, raw: j })
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'prediction error' })
  }
}
