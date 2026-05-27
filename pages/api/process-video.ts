import type { NextApiRequest, NextApiResponse } from 'next'

const CLOUDINARY_CLOUD = process.env.CLOUDINARY_CLOUD_NAME || ''
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || ''

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const { videoPublicId, logoPublicId } = req.body
  if (!videoPublicId || !logoPublicId) return res.status(400).json({ error: 'missing videoPublicId or logoPublicId' })

  try {
    const finalUrl = `https://res.cloudinary.com/${CLOUDINARY_CLOUD}/video/upload/l_${logoPublicId},g_north_west,x_10,y_10/${videoPublicId}.mp4`
    res.status(200).json({ url: finalUrl })
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'process error' })
  }
}
