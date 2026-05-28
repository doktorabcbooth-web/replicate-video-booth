import type { NextApiRequest, NextApiResponse } from 'next'

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
  const { imageUrl, imageDataUri, prompt, duration } = req.body
  const imageSource = imageDataUri || imageUrl
  if (!imageSource || !prompt) return res.status(400).json({ error: 'missing image or prompt' })

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

    // Seedance multimodal branch
    if (configuredModel.includes('seedance') || configuredModelRaw === 'bytedance/seedance-2.0') {
      const versionId = process.env.REPLICATE_MODEL_VERSION || await resolveModelVersion(configuredModelRaw)
      if (!versionId) return res.status(400).json({ error: 'model version could not be resolved; set REPLICATE_MODEL_VERSION to a valid version id' })

      // Prefer hosted URL (imageUrl from Supabase upload) over data URI for Seedance
      const imageUrlForSeedance = imageUrl || imageDataUri

      // Seedance input: per OpenAPI schema from the model page
      // Use 'image' as starting/first frame for image-to-video generation
      // NOTE: 'image' (first frame) CANNOT be combined with reference_images or reference_videos
      const input: any = {
        prompt,
        image: imageUrlForSeedance,         // selfie as starting frame
        duration: duration || 5,
        resolution: '480p',                // vertical 480p — cheapest tier
        aspect_ratio: '9:16',              // vertical format
        seed: 42,                          // fixed seed for reproducibility
        generate_audio: false,             // disable audio to save cost
      }

      console.log('Seedance input:', JSON.stringify(input, null, 2))

      // If we resolved a version id, use it. Otherwise, try the older 'model' field as a fallback.
      if (versionId) {
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

      // Fallback: if we couldn't resolve a version id (network/auth issue), attempt to call using the model name.
      try {
        const resp2 = await fetch('https://api.replicate.com/v1/predictions', {
          method: 'POST',
          headers: {
            'Authorization': `Token ${REPLICATE_API_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ model: configuredModelRaw, input })
        })
        const j2 = await resp2.json()
        return res.status(resp2.status).json({ ok: resp2.ok, id: j2.id, raw: j2 })
      } catch (fallbackErr: any) {
        console.error('seedance create fallback error', fallbackErr)
        return res.status(500).json({ error: 'model version could not be resolved; set REPLICATE_MODEL_VERSION to a valid version id', detail: String(fallbackErr) })
      }
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
