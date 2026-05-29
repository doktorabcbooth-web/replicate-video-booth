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

    // Seedance multimodal branch
    if (configuredModel.includes('seedance') || configuredModelRaw === 'bytedance/seedance-2.0') {
      const versionId = process.env.REPLICATE_MODEL_VERSION || await resolveModelVersion(configuredModelRaw)
      if (!versionId) return res.status(400).json({ error: 'model version could not be resolved; set REPLICATE_MODEL_VERSION to a valid version id' })

      const referenceImage1 = imageUrl || imageDataUri // selfie from camera
      const referenceImage2 = 'https://res.cloudinary.com/do4hqtjxb/image/upload/v1779910689/Icon_uu7a2w.png' // logo

      // The original Cloudinary video is HEVC-encoded. The Seedance model rejects
      // HEVC containers and Cloudinary's on-the-fly vc_h264 transcode streams
      // without Content-Length, which the model also can't handle.
      // Fix: download the H.264 transcoded bytes, then upload to Replicate's
      // file hosting so the model gets a clean, complete file with proper headers.
      const CLOUDINARY_VIDEO_URL = 'https://res.cloudinary.com/do4hqtjxb/video/upload/vc_h264/v1780060428/GlamAI_qlstmt.mp4'
      let referenceVideo1: string
      try {
        console.log('Pre-fetching reference video for re-upload...')
        const vidResp = await fetch(CLOUDINARY_VIDEO_URL)
        if (!vidResp.ok) throw new Error(`Failed to fetch video: ${vidResp.status}`)
        const vidBuffer = await vidResp.arrayBuffer()
        console.log(`Fetched video: ${vidBuffer.byteLength} bytes, uploading to Replicate...`)

        const formData = new FormData()
        formData.append('content', new Blob([vidBuffer], { type: 'video/mp4' }), 'reference.mp4')
        const uploadResp = await fetch('https://api.replicate.com/v1/files', {
          method: 'POST',
          headers: { 'Authorization': `Token ${REPLICATE_API_TOKEN}` },
          body: formData,
        })
        const uploadJson = await uploadResp.json()
        if (!uploadResp.ok) throw new Error(`Replicate file upload failed: ${JSON.stringify(uploadJson)}`)
        referenceVideo1 = uploadJson.urls?.get || uploadJson.url
        if (!referenceVideo1) throw new Error(`No URL in Replicate file upload response: ${JSON.stringify(uploadJson)}`)
        console.log('Reference video uploaded to Replicate:', referenceVideo1)
      } catch (uploadErr: any) {
        console.error('Video re-upload failed, falling back to direct Cloudinary URL', uploadErr)
        referenceVideo1 = CLOUDINARY_VIDEO_URL
      }

      const seedancePrompt = `The character from [Image1] turns around and suddenly is in a world cup football stadium, runs forward with a single football, dribbles past two defenders, shoots once into the goal and scores a goal that hits the net of the goal in a cinematographic way, then celebrates facing the camera. Night match in a packed world championship stadium. Huge flags in the crowd show the [image2] logo, waving in the stands. Cinematic broadcast style, smooth camera, no extra balls. Photorealistic content. motion transfer, style reference, and editing from [video1]`

      // Seedance input: using reference_images + reference_videos (multimodal)
      const input: any = {
        prompt: seedancePrompt,
        reference_images: [referenceImage1, referenceImage2],
        reference_videos: [referenceVideo1],
        duration: 5,
        resolution: '480p',
        aspect_ratio: '9:16',
        seed: 99,
        generate_audio: false,
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
