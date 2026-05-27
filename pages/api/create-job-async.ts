import type { NextApiRequest, NextApiResponse } from 'next'

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN || ''

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const { imageUrl, prompt } = req.body
  if (!imageUrl) return res.status(400).json({ error: 'missing imageUrl' })
  if (!prompt) return res.status(400).json({ error: 'missing prompt' })

  try {
    // Choose model shape: minimax/video-01 uses model+input; other models use version
    if ((process.env.REPLICATE_MODEL_ID || '').toLowerCase() === 'minimax/video-01') {
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

    const r = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ version: process.env.REPLICATE_MODEL_VERSION, input: { image: imageUrl, prompt } })
    })
    const data = await r.json()
    return res.status(200).json({ ok: true, id: data.id, raw: data })
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'prediction error' })
  }
}
import type { NextApiRequest, NextApiResponse } from 'next'

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN || ''

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const { imageUrl, prompt } = req.body
  if (!imageUrl || !prompt) return res.status(400).json({ error: 'missing imageUrl or prompt' })

  try {
    // Use minimax/video-01 if configured, otherwise use REPLICATE_MODEL_VERSION
    if ((process.env.REPLICATE_MODEL_ID || '').toLowerCase() === 'minimax/video-01') {
      const resp = await fetch('https://api.replicate.com/v1/predictions', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${REPLICATE_API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ model: 'minimax/video-01', input: { prompt, prompt_optimizer: true } })
      })
      const j = await resp.json()
      return res.status(200).json({ id: j.id })
    }

    const resp = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ version: process.env.REPLICATE_MODEL_VERSION, input: { image: imageUrl, prompt } })
    })
    const j = await resp.json()
    return res.status(200).json({ id: j.id })
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'prediction error' })
  }
}
