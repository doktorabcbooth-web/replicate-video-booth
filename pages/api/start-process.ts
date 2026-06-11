import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN || ''
const REFERENCE_PLAYER_URL =
  'https://res.cloudinary.com/do4hqtjxb/image/upload/v1780410172/tmpycv2arjr_yrcntx.jpg'

const GPT_IMAGE_PROMPT = `Replace the player from image2 with the person from image1 but wearing the same doktorabc clothes. Add a cool pair of cycling sunglasses on their face. They won't be staring to the camera but to the goal, ready to score. Keep the style photorealistic. Make sure the person looks like them in real life and that the head is keeping realistic proportion with the body and perspective of the image. Make the player be a bit further from the camera than in the reference image.`

const SUPABASE_URL = process.env.SUPABASE_URL || ''
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') return res.status(405).end()
  const { imageUrl, email } = req.body

  if (!imageUrl) return res.status(400).json({ error: 'missing imageUrl' })
  if (!email) return res.status(400).json({ error: 'missing email' })

  try {
    // 1. Insert record into leads table to track processing state
    let leadId = `temp-${Date.now()}`
    try {
      const { data, error: dbError } = await supabase
        .from('leads')
        .insert([{ email, video_url: 'processing' }])
        .select()

      if (dbError || !data || data.length === 0) {
        console.warn('Failed to create lead record (falling back to temporary tracking ID):', dbError)
      } else {
        leadId = String(data[0].id)
        console.log(`Created lead tracking record with ID: ${leadId} for ${email}`)
      }
    } catch (err) {
      console.warn('Supabase lead insertion threw an error (falling back to temporary tracking ID):', err)
    }

    // Determine base URL for webhooks dynamically.
    // If APP_URL points to localhost but the request came from a public URL (or vice-versa),
    // override it using request headers.
    const host = (req.headers['x-forwarded-host'] || req.headers.host || '') as string
    const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1')
    let baseUrl = process.env.APP_URL || ''

    if (!baseUrl || (baseUrl.includes('localhost') && !isLocalhost)) {
      const protocol = req.headers['x-forwarded-proto'] || 'https'
      baseUrl = `${protocol}://${host}`
    }

    // Ensure public webhooks always use HTTPS
    if (!isLocalhost && baseUrl.startsWith('http://')) {
      baseUrl = baseUrl.replace('http://', 'https://')
    }

    const webhookUrl = `${baseUrl}/api/replicate-webhook?leadId=${leadId}&step=gpt-image&email=${encodeURIComponent(email)}`

    console.log('Registering webhook URL:', webhookUrl)

    // 2. Start GPT Image compositing via Replicate
    const input = {
      prompt: GPT_IMAGE_PROMPT,
      input_images: [imageUrl, REFERENCE_PLAYER_URL],
      aspect_ratio: '3:2',
      number_of_images: 1,
      quality: 'high',
      output_compression: 90,
      output_format: 'png',
    }

    const resp = await fetch('https://api.replicate.com/v1/models/openai/gpt-image-2/predictions', {
      method: 'POST',
      headers: {
        Authorization: `Token ${REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input,
        webhook: webhookUrl,
        webhook_events_filter: ['completed'],
      }),
    })

    const j = await resp.json()
    console.log('GPT Image Prediction trigger response:', j)

    if (!resp.ok) {
      // Update DB to failed if we failed to start Replicate
      await supabase
        .from('leads')
        .update({ video_url: 'failed' })
        .eq('id', leadId)
      return res.status(resp.status).json({ error: j.detail || 'Failed to trigger image generation' })
    }

    return res.status(200).json({ ok: true, leadId, message: 'Processing started' })
  } catch (err: any) {
    console.error('start-process error:', err)
    return res.status(500).json({ error: err.message || 'Server error starting process' })
  }
}
