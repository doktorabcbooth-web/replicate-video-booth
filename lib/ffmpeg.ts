import ffmpegPath from 'ffmpeg-static'
import ffmpeg from 'fluent-ffmpeg'
import path from 'path'

ffmpeg.setFfmpegPath(ffmpegPath || '')

export function overlayLogo(inputVideo: string, logoPath: string, outputPath: string) {
  return new Promise<void>((resolve, reject) => {
    ffmpeg(inputVideo)
      .input(logoPath)
      .complexFilter([{"filter":"overlay","options":{"x":10,"y":10}}])
      .outputOptions(['-c:v libx264', '-crf 23', '-preset veryfast'])
  .save(outputPath)
  .on('end', () => resolve())
  .on('error', (err: Error) => reject(err))
  })
}
