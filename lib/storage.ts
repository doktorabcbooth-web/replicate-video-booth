import fs from 'fs'
import path from 'path'

const uploadDir = path.join(process.cwd(), 'uploads')
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir)

export function saveLocalFile(tempPath: string, filename: string) {
  const dest = path.join(uploadDir, filename)
  fs.copyFileSync(tempPath, dest)
  return dest
}

// TODO: add S3 upload adapter using AWS SDK when needed
