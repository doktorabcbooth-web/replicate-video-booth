import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || ''
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  
  const { leadId } = req.query
  if (!leadId) {
    return res.status(400).json({ error: 'missing leadId' })
  }

  // If leadId is a temporary ID (DB was unavailable at start), we can't query status
  const leadIdStr = Array.isArray(leadId) ? leadId[0] : leadId
  if (leadIdStr.startsWith('temp-')) {
    return res.status(200).json({ status: 'processing', videoUrl: null })
  }

  try {
    const { data, error } = await supabase
      .from('leads')
      .select('video_url')
      .eq('id', leadIdStr)
      .single()

    if (error || !data) {
      // Table may not exist or record not found — return processing so frontend doesn't error
      console.warn(`Job status lookup failed for lead ID: ${leadIdStr}`, error)
      return res.status(200).json({ status: 'processing', videoUrl: null })
    }

    const videoUrl = data.video_url

    if (videoUrl === 'processing') {
      return res.status(200).json({ status: 'processing', videoUrl: null })
    } else if (videoUrl === 'failed') {
      return res.status(200).json({ status: 'failed', videoUrl: null })
    } else if (videoUrl && videoUrl.startsWith('http')) {
      return res.status(200).json({ status: 'completed', videoUrl })
    } else {
      return res.status(200).json({ status: 'processing', videoUrl: null })
    }
  } catch (err: any) {
    console.error('job-status error:', err)
    return res.status(200).json({ status: 'processing', videoUrl: null })
  }
}
