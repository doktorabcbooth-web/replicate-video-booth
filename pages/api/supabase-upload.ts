import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || ''
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const { filename, contentType } = req.body
  if (!filename || !contentType) return res.status(400).json({ error: 'missing filename or contentType' })

  // Create a signed upload URL (Supabase storage uses public buckets or presigned URLs via service key)
  try {
    const bucket = process.env.SUPABASE_BUCKET || 'uploads'
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(filename, 60)
    if (error) throw error
    res.status(200).json({ url: data?.signedUrl })
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'upload error' })
  }
}
