import type { NextApiRequest, NextApiResponse } from 'next'
import formidable from 'formidable'
import fs from 'fs'
import path from 'path'

export const config = {
  api: {
    bodyParser: false,
  },
}

const uploadDir = path.join(process.cwd(), 'uploads')
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const form = formidable({ multiples: false, uploadDir, keepExtensions: true })
  form.parse(req, (err, fields, files) => {
    if (err) return res.status(500).json({ error: 'upload error' })
    // TODO: return file paths and metadata
    res.status(200).json({ fields, files })
  })
}
