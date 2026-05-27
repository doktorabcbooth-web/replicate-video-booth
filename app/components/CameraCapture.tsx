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
  const [prompt, setPrompt] = useState<string>(`Starting from the reference image as starting frame, the subject slowly comes to life on a football pitch. He dribbles forward at a controlled pace, weaving through two opposing defenders who challenge him closely. The movement is deliberate and grounded — no superhuman speed, just natural athletic motion. He shifts his weight, fakes left, beats the last defender, and slots the ball into the bottom corner of the net. The goalkeeper dives but can't reach it. The stadium crowd cheers in the background. Photorealistic, shot on cinema camera, natural stadium floodlight lighting, shallow depth of field on subject, broadcast TV football aesthetic, slight motion blur on the ball.`)

  async function submitJob() {
    if (!photo) return alert('take a photo first')
    if (!email) return alert('enter your email')
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
    const imageUrl = uploadData.publicUrl

    setStatus('Starting Runway job...')
    // Use async create endpoint so browser doesn't block
    const createResp = await fetch('/api/create-job-async', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageUrl, prompt, duration: 5 }) })
    const createData = await createResp.json()
    if (!createData?.ok || !createData?.id) return setStatus('Failed to start job: ' + (createData?.error || JSON.stringify(createData)))
    const id = createData.id
    setStatus('Job started, polling status...')

    // Poll status endpoint until succeeded
    let finalStatus = null
    for (;;) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 3000))
      // eslint-disable-next-line no-await-in-loop
      const sResp = await fetch(`/api/prediction-status?id=${encodeURIComponent(id)}`)
      const s = await sResp.json()
      finalStatus = s.status || s.state || s
      // Try to show logs progress
      if (s.logs) setStatus(`Processing — ${s.status || ''} — ${s.logs.split('\n').slice(-2).join(' | ')}`)
      else setStatus(`Processing — ${s.status || ''}`)
      if (s.status === 'succeeded' || s.state === 'succeeded') break
      if (s.status === 'failed' || s.state === 'failed') return setStatus('Job failed')
    }

    setStatus('Finalizing prediction and uploading video...')
    const finResp = await fetch('/api/finalize-prediction', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    const fin = await finResp.json()
    if (!fin?.ok || !fin?.publicId) return setStatus('Finalize failed: ' + JSON.stringify(fin))

    setStatus('Creating overlay URL...')
    const logoPublicId = process.env.NEXT_PUBLIC_CLOUDINARY_LOGO_ID || 'Icon_uu7a2w'
    const procResp = await fetch('/api/process-video', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ videoPublicId: fin.publicId, logoPublicId }) })
    const procData = await procResp.json()
    if (!procData?.url) return setStatus('Failed to create overlay URL')

    setStatus('Sending email...')
    const emailResp = await fetch('/api/email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: email, videoUrl: procData.url }) })
    const emailData = await emailResp.json()
    if (emailData?.ok) setStatus('Email sent! Check your inbox (or spam).')
    else setStatus('Email failed: ' + JSON.stringify(emailData))
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
          <input
            className="block border p-2 rounded w-full"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submitJob() }}
            placeholder="you@example.com"
          />
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
