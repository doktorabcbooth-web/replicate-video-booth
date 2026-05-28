import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' })

  const token = process.env.REPLICATE_API_TOKEN
  if (!token) return res.status(400).json({ error: 'REPLICATE_API_TOKEN not set in environment' })

  const modelQuery = String(req.query.model || process.env.REPLICATE_MODEL_ID || 'bytedance/seedance-2.0')

  try {
    const r = await fetch(`https://api.replicate.com/v1/models/${encodeURIComponent(modelQuery)}`, {
      headers: { Authorization: `Token ${token}` },
    })
    const j = await r.json()
    if (!r.ok) return res.status(r.status).json({ ok: false, status: r.status, raw: j })

    const defaultVersion = j?.default_version?.id || null
    const versions = Array.isArray(j?.versions) ? j.versions.map((v: any) => ({ id: v.id, created_at: v.created_at })) : []

    return res.status(200).json({ ok: true, model: modelQuery, defaultVersion, versions, raw: j })
  } catch (err: any) {
    console.error('debug-replicate-version error', err)
    return res.status(500).json({ error: err?.message || String(err) })
  }
}
