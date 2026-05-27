"use client"

import { useRef, useState } from 'react'

export default function CameraCapture() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [photo, setPhoto] = useState<string | null>(null)

  async function startCamera() {
    if (!videoRef.current) return
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
    videoRef.current.srcObject = stream
    await videoRef.current.play()
  }

  function takePhoto() {
    if (!videoRef.current || !canvasRef.current) return
    const ctx = canvasRef.current.getContext('2d')
    if (!ctx) return
    canvasRef.current.width = videoRef.current.videoWidth
    canvasRef.current.height = videoRef.current.videoHeight
    ctx.drawImage(videoRef.current, 0, 0)
    const data = canvasRef.current.toDataURL('image/jpeg')
    setPhoto(data)
  }

  const [email, setEmail] = useState('')
  const [referenceFile, setReferenceFile] = useState<File | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  async function submitJob() {
    if (!photo) return alert('take a photo first')
    setStatus('Uploading selfie...')

    // Upload selfie base64 to server which will upload to Supabase
    const selfieBlob = await (await fetch(photo)).blob()
    const b64 = await selfieBlob.arrayBuffer().then((ab) => Buffer.from(ab).toString('base64'))
    const selfieFilename = `selfie-${Date.now()}.jpg`
    const uploadResp = await fetch('/api/upload-to-supabase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: selfieFilename, b64: b64, contentType: selfieBlob.type })
    })
    const uploadData = await uploadResp.json()
    if (!uploadData?.ok) return setStatus('Failed to upload selfie')
    setStatus('Selfie uploaded')

    // If reference video provided, upload similarly (TODO)
    let referenceUrl = null
    if (referenceFile) {
      setStatus('Uploading reference video...')
      // For simplicity, the same flow would apply
      const refFilename = `ref-${Date.now()}-${referenceFile.name}`
  const refBuffer = await referenceFile.arrayBuffer()
  const refB64 = Buffer.from(refBuffer).toString('base64')
  const refResp = await fetch('/api/upload-to-supabase', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename: refFilename, b64: refB64, contentType: referenceFile.type }) })
  const refData = await refResp.json()
  if (refData.ok) referenceUrl = refData.publicUrl
      setStatus('Reference uploaded')
    }

    setStatus('Creating Replicate job...')
    const createResp = await fetch('/api/create-job', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageUrl: selfieFilename, referenceVideoUrl: referenceUrl }) })
    const createData = await createResp.json()
    // createData should contain job info and eventually a video public id or url
    setStatus('Job started — polling for result (this may take a while)')

    // Expect createData to return cloudinaryPublicId after server uploads result to Cloudinary
    const resultVideoPublicId = createData?.cloudinaryPublicId

    if (!resultVideoPublicId) {
      setStatus('No result from Replicate yet — please check server logs')
      return
    }

    setStatus('Creating Cloudinary overlay URL...')
    const logoPublicId = process.env.NEXT_PUBLIC_CLOUDINARY_LOGO_ID || 'logo'
    const procResp = await fetch('/api/process-video', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ videoPublicId: resultVideoPublicId, logoPublicId }) })
    const procData = await procResp.json()
    if (!procData.url) return setStatus('Failed to process video')

    setStatus('Sending email...')
    const emailResp = await fetch('/api/email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: email, videoUrl: procData.url }) })
    const emailData = await emailResp.json()
    if (emailData.ok) setStatus('Email sent!')
    else setStatus('Email failed')
  }

  return (
    <div>
      <div className="space-y-3">
        <video ref={videoRef} className="w-full rounded bg-black" />
        <div className="flex gap-2">
          <button onClick={startCamera} className="px-4 py-2 bg-blue-600 text-white rounded">Start Camera</button>
          <button onClick={takePhoto} className="px-4 py-2 bg-green-600 text-white rounded">Take Photo</button>
        </div>
        {photo && (
          <div>
            <h3 className="font-semibold">Preview</h3>
            <img src={photo} alt="preview" className="w-48 h-48 object-cover rounded" />
          </div>
        )}

        <div className="pt-3">
          <label className="block">Reference video (optional)</label>
          <input type="file" accept="video/*" onChange={(e) => setReferenceFile(e.target.files?.[0] ?? null)} />
        </div>

        <div>
          <label>Your email</label>
          <input className="block border p-2 rounded w-full" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </div>

        <div>
          <button onClick={submitJob} className="mt-3 px-4 py-2 bg-indigo-600 text-white rounded">Create Video & Send</button>
        </div>

        {status && <div className="mt-2 text-sm">{status}</div>}
      </div>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  )
}
