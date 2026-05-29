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
    // DoktorABC SVG logo: https://res.cloudinary.com/do4hqtjxb/image/upload/v1780067385/doktorabc-logo_uwqswp.svg
    // To add a clean white background behind the SVG logo without cut edges, we pad the overlay image with a white background.
    // Cloudinary chain: w_160,h_55,c_pad,b_white,r_max creates a clean rounded white pill containing the SVG.
    const finalUrl = `https://res.cloudinary.com/${CLOUDINARY_CLOUD}/video/upload/w_480,h_853,c_fill/l_doktorabc-logo_uwqswp,w_160,h_55,c_pad,b_white,r_max,g_south,y_40/${videoPublicId}.mp4`
    res.status(200).json({ url: finalUrl })
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'process error' })
  }
}
