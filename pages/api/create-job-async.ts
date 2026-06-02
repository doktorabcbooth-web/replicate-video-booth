import type { NextApiRequest, NextApiResponse } from 'next'

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
  },
}

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN || ''
let _cachedVersion: string | null = null

async function resolveModelVersion(modelIdOrName: string) {
  if (!modelIdOrName) return null
  // if it looks like a version id (no slash), return as-is
  if (!modelIdOrName.includes('/')) return modelIdOrName
  if (_cachedVersion) return _cachedVersion
  try {
    const r = await fetch(`https://api.replicate.com/v1/models/${encodeURIComponent(modelIdOrName)}`, {
      headers: { Authorization: `Token ${REPLICATE_API_TOKEN}` },
    })
  const j = await r.json()
  // Prefer default_version, then latest_version, then first versions[] entry
  const v = j?.default_version?.id || j?.latest_version?.id || (j?.versions && j.versions[0]?.id)
    if (v) _cachedVersion = v
    return v
  } catch (e) {
    console.error('resolveModelVersion error', e)
    return null
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const { imageUrl, imageDataUri, duration, prompt } = req.body
  const imageSource = imageDataUri || imageUrl
  if (!imageUrl) return res.status(400).json({ error: 'missing imageUrl' })

  try {
    const configuredModelRaw = (process.env.REPLICATE_MODEL_ID || process.env.REPLICATE_MODEL_VERSION || 'bytedance/seedance-2.0').trim()
    const configuredModel = configuredModelRaw.toLowerCase()

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
      return res.status(resp.status).json({ ok: resp.ok, id: j.id, raw: j })
    }

    // Seedance image-to-video branch (prompt-only, no reference images/videos)
    if (configuredModel.includes('seedance') || configuredModelRaw === 'bytedance/seedance-2.0') {
      const versionId = process.env.REPLICATE_MODEL_VERSION || await resolveModelVersion(configuredModelRaw)
      if (!versionId) return res.status(400).json({ error: 'model version could not be resolved; set REPLICATE_MODEL_VERSION to a valid version id' })

      const seedancePrompt = `A person receives a football pass, turns and starts running towards the goal with the ball at their feet. They dribble past three players, shoot at goal, score a goal and then turn to celebrate, raising their arms in the air with joy. Photorealistic, cinematic lighting, vertical video.`

      // Image-to-video: use the 'image' input field (cannot be combined with reference_images)
      const input: any = {
        image: imageUrl,
        prompt: seedancePrompt,
        duration: 5,
        resolution: '480p',
        aspect_ratio: '9:16',
        seed: 99,
        generate_audio: false,
      }

      console.log('Seedance input:', JSON.stringify(input, null, 2))

      const resp = await fetch('https://api.replicate.com/v1/predictions', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${REPLICATE_API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ version: versionId, input })
      })
      const j = await resp.json()
      console.log('Seedance response:', j)
      return res.status(resp.status).json({ ok: resp.ok, id: j.id, raw: j })
    }


    // Runway / Gen-4 branch: use first_frame_image like the UI
    if (configuredModel.includes('runway') || configuredModel.includes('gen-4')) {
      const imageSource2 = imageSource
      const input: any = {
        first_frame_image: imageSource2,
        image: imageSource2,
        init_image: imageSource2,
        prompt,
      }
      if (duration) {
        input.duration = duration
        input.seconds = duration
        input.length = duration
      }
      const versionId = process.env.REPLICATE_MODEL_VERSION || await resolveModelVersion(configuredModelRaw)
      const resp = await fetch('https://api.replicate.com/v1/predictions', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${REPLICATE_API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ version: versionId, input })
      })
      const j = await resp.json()
      return res.status(resp.status).json({ ok: resp.ok, id: j.id, raw: j })
    }

    // Default: version-based call with image key
    const versionIdFallback = process.env.REPLICATE_MODEL_VERSION || await resolveModelVersion(configuredModelRaw)
    if (!versionIdFallback) return res.status(400).json({ error: 'model version not configured or resolved' })
    const resp = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ version: versionIdFallback, input: { image: imageSource, prompt } })
    })
    const j = await resp.json()
    return res.status(resp.status).json({ ok: resp.ok, id: j.id, raw: j })
  } catch (err: any) {
    console.error('create-job-async error', err)
    return res.status(500).json({ error: err.message || 'prediction error' })
  }
}
