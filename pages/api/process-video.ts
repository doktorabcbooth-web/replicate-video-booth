import type { NextApiRequest, NextApiResponse } from 'next'

const CLOUDINARY_CLOUD = process.env.CLOUDINARY_CLOUD_NAME || ''
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || ''

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const { videoPublicId, logoPublicId } = req.body
  if (!videoPublicId || !logoPublicId) return res.status(400).json({ error: 'missing videoPublicId or logoPublicId' })

  try {
    // DoktorABC SVG logo: https://res.cloudinary.com/do4hqtjxb/image/upload/v1780067385/doktorabc-logo_uwqswp.svg
    // Center-bottom placement matching "Created by Glam AI" layout.
    // Cloudinary supports overlay of images (including remote SVGs) using:
    // l_logoPublicId (if logoPublicId is an uploaded asset) or using custom overlay properties.
    // Since the logo is here: https://res.cloudinary.com/do4hqtjxb/image/upload/v1780067385/doktorabc-logo_uwqswp.svg
    // The public id is "doktorabc-logo_uwqswp".
    // We position it at the south (bottom) with a offset y of 40 pixels, scaling its width to 140 pixels.
    const finalUrl = `https://res.cloudinary.com/${CLOUDINARY_CLOUD}/video/upload/w_480,h_853,c_fill/l_doktorabc-logo_uwqswp,w_140,g_south,y_40/${videoPublicId}.mp4`
    res.status(200).json({ url: finalUrl })
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'process error' })
  }
}
