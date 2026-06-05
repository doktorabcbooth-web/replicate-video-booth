import type { NextApiRequest, NextApiResponse } from 'next'

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN || ''

// Reference footballer image for GPT Image compositing
const REFERENCE_PLAYER_URL =
  'https://res.cloudinary.com/do4hqtjxb/image/upload/v1780410172/tmpycv2arjr_yrcntx.jpg'

const GPT_IMAGE_PROMPT = `Replace the player from image2 with the person from image1 but wearing the same doktorabc clothes. Add a cool pair of cycling sunglasses on their face. They won't be staring to the camera but to the goal, ready to score. Keep the style photorealistic. Make sure the person looks like them in real life.`

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') return res.status(405).end()
  const { imageUrl } = req.body
  if (!imageUrl)
    return res.status(400).json({ error: 'missing imageUrl (selfie)' })

  try {
    const input = {
      prompt: GPT_IMAGE_PROMPT,
      input_images: [imageUrl, REFERENCE_PLAYER_URL],
      aspect_ratio: '3:2',
      number_of_images: 1,
      quality: 'high',
      output_compression: 90,
      output_format: 'png',
    }

    console.log('GPT Image input:', JSON.stringify(input, null, 2))

    const resp = await fetch('https://api.replicate.com/v1/models/openai/gpt-image-2/predictions', {
      method: 'POST',
      headers: {
        Authorization: `Token ${REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input }),
    })
    const j = await resp.json()
    console.log('GPT Image response:', j)
    return res
      .status(resp.status)
      .json({ ok: resp.ok, id: j.id, raw: j })
  } catch (err: any) {
    console.error('create-gpt-image error', err)
    return res
      .status(500)
      .json({ error: err.message || 'gpt-image prediction error' })
  }
}
