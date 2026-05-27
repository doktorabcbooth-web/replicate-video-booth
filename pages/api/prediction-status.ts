import type { NextApiRequest, NextApiResponse } from 'next'

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN || ''

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const id = req.query.id as string
  if (!id) return res.status(400).json({ error: 'missing id' })

  try {
    const r = await fetch(`https://api.replicate.com/v1/predictions/${id}`, { headers: { Authorization: `Token ${REPLICATE_API_TOKEN}` } })
    const j = await r.json()
    return res.status(200).json(j)
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'status error' })
  }
}
