import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { v2 as cloudinary } from 'cloudinary'
import { Resend } from 'resend'

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN || ''
const resend = new Resend(process.env.RESEND_API_KEY || '')

const SUPABASE_URL = process.env.SUPABASE_URL || ''
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

let _cachedVersion: string | null = null

async function resolveModelVersion(modelIdOrName: string) {
  if (!modelIdOrName) return null
  if (!modelIdOrName.includes('/')) return modelIdOrName
  if (_cachedVersion) return _cachedVersion
  try {
    const r = await fetch(`https://api.replicate.com/v1/models/${encodeURIComponent(modelIdOrName)}`, {
      headers: { Authorization: `Token ${REPLICATE_API_TOKEN}` },
    })
    const j = await r.json()
    const v = j?.default_version?.id || j?.latest_version?.id || (j?.versions && j.versions[0]?.id)
    if (v) _cachedVersion = v
    return v
  } catch (e) {
    console.error('resolveModelVersion error', e)
    return null
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Replicate webhooks are POST requests
  if (req.method !== 'POST') return res.status(405).end()

  const { leadId, step, email: queryEmail } = req.query
  if (!leadId || !step) {
    console.error('Missing leadId or step in webhook query params')
    return res.status(400).json({ error: 'missing leadId or step' })
  }
  const emailParam = Array.isArray(queryEmail) ? queryEmail[0] : (queryEmail || '')

  const prediction = req.body
  console.log(`Webhook received for Lead: ${leadId}, Step: ${step}, Status: ${prediction?.status}`)

  try {
    // 1. Check if prediction failed or was canceled
    if (prediction?.status === 'failed' || prediction?.status === 'canceled') {
      console.error(`Prediction failed/canceled for lead ${leadId}:`, prediction?.error)
      try {
        await supabase.from('leads').update({ video_url: 'failed' }).eq('id', leadId)
      } catch (e) { console.warn('DB update failed (non-blocking):', e) }
      return res.status(200).json({ ok: false, message: 'Prediction failed updated' })
    }

    if (prediction?.status !== 'succeeded') {
      // Still in progress, return 200 to acknowledge Replicate notification
      return res.status(200).json({ ok: true, message: 'processing' })
    }

    // Determine base URL for subsequent webhooks dynamically.
    const host = (req.headers['x-forwarded-host'] || req.headers.host || '') as string
    const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1')
    let baseUrl = process.env.APP_URL || ''

    if (!baseUrl || (baseUrl.includes('localhost') && !isLocalhost)) {
      const protocol = req.headers['x-forwarded-proto'] || 'https'
      baseUrl = `${protocol}://${host}`
    }

    if (!isLocalhost && baseUrl.startsWith('http://')) {
      baseUrl = baseUrl.replace('http://', 'https://')
    }

    // 2. Handle Step: GPT Image
    if (step === 'gpt-image') {
      const output = prediction.output
      const gptImageUrl = Array.isArray(output) ? output[0] : output

      if (!gptImageUrl) {
        console.error(`No output image URL in GPT Image step for lead ${leadId}`)
        try { await supabase.from('leads').update({ video_url: 'failed' }).eq('id', leadId) } catch (e) { /* non-blocking */ }
        return res.status(500).json({ error: 'No output image URL from GPT Image step' })
      }

      console.log(`GPT Image succeeded for lead ${leadId}. URL: ${gptImageUrl}. Starting video step...`)

      // Trigger Step 2: Seedance (video generation)
      const configuredModelRaw = (process.env.REPLICATE_MODEL_ID || process.env.REPLICATE_MODEL_VERSION || 'bytedance/seedance-2.0').trim()
      const configuredModel = configuredModelRaw.toLowerCase()

      const seedancePrompt = `A person receives a football pass, turns and starts running towards the goal with the ball at their feet. They dribble past three players, shoot at goal, score a goal and then turn to celebrate, raising their arms in the air with joy. Photorealistic, cinematic lighting, vertical video.`

      let bodyPayload: any = {}

      if (configuredModel.includes('minimax/video-01')) {
        bodyPayload = {
          model: 'minimax/video-01',
          input: { prompt: seedancePrompt, prompt_optimizer: true }
        }
      } else if (configuredModel.includes('seedance') || configuredModelRaw === 'bytedance/seedance-2.0') {
        const versionId = process.env.REPLICATE_MODEL_VERSION || await resolveModelVersion(configuredModelRaw)
        if (!versionId) {
          throw new Error('Seedance model version could not be resolved')
        }
        bodyPayload = {
          version: versionId,
          input: {
            image: gptImageUrl,
            prompt: seedancePrompt,
            duration: 6,
            resolution: '720p',
            aspect_ratio: '9:16',
            seed: 90,
            generate_audio: false,
          }
        }
      } else if (configuredModel.includes('runway') || configuredModel.includes('gen-4')) {
        const versionId = process.env.REPLICATE_MODEL_VERSION || await resolveModelVersion(configuredModelRaw)
        bodyPayload = {
          version: versionId,
          input: {
            first_frame_image: gptImageUrl,
            image: gptImageUrl,
            init_image: gptImageUrl,
            prompt: seedancePrompt,
            duration: 5,
            seconds: 5,
            length: 5
          }
        }
      } else {
        const versionIdFallback = process.env.REPLICATE_MODEL_VERSION || await resolveModelVersion(configuredModelRaw)
        bodyPayload = {
          version: versionIdFallback,
          input: {
            image: gptImageUrl,
            prompt: seedancePrompt
          }
        }
      }

      // Append webhook config — pass email forward
      bodyPayload.webhook = `${baseUrl}/api/replicate-webhook?leadId=${leadId}&step=video-generation&email=${encodeURIComponent(emailParam)}`
      bodyPayload.webhook_events_filter = ['completed']

      const endpoint = configuredModel.includes('minimax/video-01') 
        ? 'https://api.replicate.com/v1/predictions' 
        : 'https://api.replicate.com/v1/predictions'

      console.log(`Sending video job to ${endpoint} with webhook...`)

      const videoResp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${REPLICATE_API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(bodyPayload)
      })

      const videoData = await videoResp.json()
      if (!videoResp.ok) {
        console.error('Failed to trigger video generation prediction:', videoData)
        try { await supabase.from('leads').update({ video_url: 'failed' }).eq('id', leadId) } catch (e) { /* non-blocking */ }
        return res.status(videoResp.status).json({ error: videoData.detail || 'failed to start video' })
      }

      console.log(`Video generation triggered for lead ${leadId}, prediction id: ${videoData.id}`)
      return res.status(200).json({ ok: true, message: 'Video step initiated' })
    }

    // 3. Handle Step: Video Generation
    if (step === 'video-generation') {
      let outputUrl: string | null = null
      const j = prediction
      if (Array.isArray(j.output) && j.output.length) outputUrl = j.output[0]
      if (!outputUrl && typeof j.output === 'string') outputUrl = j.output
      if (!outputUrl && j.output?.url) outputUrl = j.output.url
      if (!outputUrl && j.result?.url) outputUrl = j.result.url

      if (!outputUrl && j.output && typeof j.output === 'object') {
        for (const k of Object.keys(j.output)) {
          const v = (j.output as any)[k]
          if (typeof v === 'string' && v.match(/^https?:\/\/.+\.(mp4|mov|webm)/i)) { outputUrl = v; break }
          if (v && typeof v === 'object' && typeof v.url === 'string') { outputUrl = v.url; break }
        }
      }

      if (!outputUrl) {
        console.error(`No output video URL in video-generation step for lead ${leadId}`)
        try { await supabase.from('leads').update({ video_url: 'failed' }).eq('id', leadId) } catch (e) { /* non-blocking */ }
        return res.status(500).json({ error: 'No output video URL from video-generation' })
      }

      console.log(`Video generation succeeded for lead ${leadId}. Output: ${outputUrl}. Uploading to Cloudinary...`)

      // Upload output video to Cloudinary
      const upload = await cloudinary.uploader.upload(outputUrl, { resource_type: 'video' })
      const videoPublicId = upload.public_id

      // Apply Logo overlay (no overlay version)
      const CLOUDINARY_CLOUD = process.env.CLOUDINARY_CLOUD_NAME || ''
      const finalUrl = `https://res.cloudinary.com/${CLOUDINARY_CLOUD}/video/upload/w_720,h_1280,c_fill/${videoPublicId}.mp4`

      console.log(`Cloudinary overlay generated: ${finalUrl}`)

      // Get email from query params (primary) or DB fallback
      let toEmail = emailParam
      if (!toEmail) {
        try {
          const { data: leadRecord } = await supabase
            .from('leads')
            .select('email')
            .eq('id', leadId)
            .single()
          toEmail = leadRecord?.email || ''
        } catch (e) {
          console.warn('DB email lookup failed:', e)
        }
      }

      if (!toEmail) {
        console.error(`No email available for lead ${leadId}`)
        return res.status(500).json({ error: 'No email available to send video' })
      }

      // Save to database
      try {
        await supabase.from('generated_videos').insert([{ video_url: finalUrl }])
      } catch (dbErr) {
        console.error('Database generated_videos insert error:', dbErr)
      }

      // Update lead table record with the final video URL
      const { error: updateError } = await supabase
        .from('leads')
        .update({ video_url: finalUrl })
        .eq('id', leadId)

      if (updateError) {
        console.error('Database lead update error:', updateError)
      }

      // Send Email
      const downloadUrl = finalUrl.includes('/upload/') ? finalUrl.replace('/upload/', '/upload/fl_attachment/') : finalUrl

      const emailHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>DoctorABC World Cup Star</title>
            <style>
              body { font-family: 'Poppins', Helvetica, Arial, sans-serif; background-color: #E7FCF7; color: #0D2C54; padding: 20px; margin: 0; }
              .email-container { max-width: 500px; margin: 0 auto; background: #ffffff; border-radius: 30px; padding: 30px; box-shadow: 0 10px 30px rgba(13,44,84,0.06); border: 1px solid rgba(13, 44, 84, 0.08); text-align: center; }
              .logo-header { display: inline-flex; align-items: center; justify-content: center; margin-bottom: 25px; padding: 10px 18px; border-radius: 999px; background: #EEF1F6; }
              .logo-header img { width: 140px; height: 38px; object-fit: contain; }
              h1 { font-size: 22px; font-weight: 700; color: #0D2C54; line-height: 1.4; margin: 0 0 20px 0; }
              .video-preview { border-radius: 12px; overflow: hidden; margin: 25px 0; border: 1px solid rgba(13, 44, 84, 0.1); background: #000; display: block; position: relative; }
              .video-preview img { width: 100%; display: block; }
              .btn { display: inline-block; min-height: 48px; line-height: 48px; padding: 0 35px; border-radius: 24px; background: linear-gradient(135deg, #23A470, #73C04A); color: #ffffff; font-weight: 700; font-size: 15px; text-decoration: none; box-shadow: 0 4px 15px rgba(35, 164, 112, 0.25); transition: transform 0.12s ease; margin-top: 10px; }
              .footer { margin-top: 30px; font-size: 11px; color: rgba(13, 44, 84, 0.5); }
            </style>
          </head>
          <body>
            <div class="email-container">
              <div class="logo-header">
                <img src="https://res.cloudinary.com/do4hqtjxb/image/upload/v1780067385/doktorabc-logo_uwqswp.svg" alt="DoctorABC Logo">
              </div>
              <h1>Hier ist dein KI-Video!</h1>
              <div class="video-preview">
                <a href="${finalUrl}">
                  <img src="https://res.cloudinary.com/do4hqtjxb/image/upload/v1779910689/Icon_uu7a2w.png" alt="Your Football Video Goal" style="max-height: 220px; object-fit: contain; background: #000; margin: 0 auto;">
                </a>
              </div>
              <a href="${finalUrl}" class="btn">Video ansehen</a>
              <br/>
              <a href="${downloadUrl}" class="btn" style="background: #0D2C54; margin-top: 10px; box-shadow: 0 4px 15px rgba(13, 44, 84, 0.15);">Video herunterladen</a>
              <div class="footer">
                &copy; ${new Date().getFullYear()} DoctorABC. All rights reserved.
              </div>
            </div>
          </body>
        </html>
      `

      console.log(`Sending final video email to ${toEmail}...`)

      const r = await resend.emails.send({
        from: process.env.EMAIL_FROM || 'yourvideo@doktorabcworldcup.com',
        to: toEmail,
        subject: 'Start your journey to a better health',
        html: emailHtml,
      })

      console.log(`Email successfully dispatched for lead ${leadId}. Response:`, r)
      return res.status(200).json({ ok: true, message: 'Process fully completed' })
    }

    return res.status(400).json({ error: 'invalid step' })
  } catch (err: any) {
    console.error(`Error processing webhook step ${step} for lead ${leadId}:`, err)
    // Update DB to failed
    try {
      await supabase.from('leads').update({ video_url: 'failed' }).eq('id', leadId)
    } catch (dbErr) {
      console.error('Failed to mark lead as failed:', dbErr)
    }
    return res.status(500).json({ error: err.message || 'webhook execution error' })
  }
}
