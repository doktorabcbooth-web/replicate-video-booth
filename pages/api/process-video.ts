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
    // To add a white background behind the SVG logo, we overlay a white rectangle (b_white) 
    // or overlay a custom white block first (c_fill,h_60,w_180,e_colorize,co_white) and then place the logo on top.
    // Cloudinary chain: Place white rectangle at south y_35, then place logo at south y_40.
    const finalUrl = `https://res.cloudinary.com/${CLOUDINARY_CLOUD}/video/upload/w_480,h_853,c_fill/l_doktorabc-logo_uwqswp,w_140,g_south,y_40,bo_10px_solid_white,b_white,r_max/${videoPublicId}.mp4`
    res.status(200).json({ url: finalUrl })
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'process error' })
  }
}
