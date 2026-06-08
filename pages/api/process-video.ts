import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const CLOUDINARY_CLOUD = process.env.CLOUDINARY_CLOUD_NAME || ''
const SUPABASE_URL = process.env.SUPABASE_URL || ''
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const { videoPublicId, logoPublicId } = req.body
  if (!videoPublicId || !logoPublicId) return res.status(400).json({ error: 'missing videoPublicId or logoPublicId' })

  try {
    // DoktorABC SVG logo: https://res.cloudinary.com/do4hqtjxb/image/upload/v1780067385/doktorabc-logo_uwqswp.svg
    // Center-bottom placement matching "Created by Glam AI" layout.
    // To add a clean white background behind the SVG logo without cut edges, we pad the overlay image with a white background.
    // Cloudinary chain: w_210,h_75,c_pad,b_white,r_max creates a clean rounded white pill containing the SVG.
    const finalUrl = `https://res.cloudinary.com/${CLOUDINARY_CLOUD}/video/upload/w_720,h_1280,c_fill/l_doktorabc-logo_uwqswp,w_210,h_60,c_pad,b_white,r_max,g_south,y_50/${videoPublicId}.mp4`

    // Save to database
    try {
      await supabase.from('generated_videos').insert([{ video_url: finalUrl }])
      console.log('Successfully saved generated video to database:', finalUrl)
    } catch (dbErr) {
      console.error('Database save error:', dbErr)
    }

    res.status(200).json({ url: finalUrl })
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'process error' })
  }
}
