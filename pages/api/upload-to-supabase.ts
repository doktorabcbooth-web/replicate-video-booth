import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || ''
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const { filename, b64, contentType } = req.body
  if (!filename || !b64) return res.status(400).json({ error: 'missing filename or b64' })

  try {
    const bucket = process.env.SUPABASE_BUCKET || 'uploads'
    const buffer = Buffer.from(b64, 'base64')
    const { data, error } = await supabase.storage.from(bucket).upload(filename, buffer, { contentType, upsert: true })
    if (error) throw error
    // Return a public URL (if bucket is public) or the path
    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${encodeURIComponent(filename)}`
    res.status(200).json({ ok: true, path: data?.path, publicUrl })
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'upload error' })
  }
}
