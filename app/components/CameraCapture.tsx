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
  // reference video removed — we only use the selfie as the starting frame
  const [status, setStatus] = useState<string | null>(null)
  const [prompt, setPrompt] = useState<string>(() => `IMAGE-TO-VIDEO: Use the supplied selfie as the exact first frame and the identity of the main subject. Replace the player in the scene with the person from the photo (face and body texture swap) so the person in the selfie is the player throughout the clip. Produce a photorealistic 5s video starting directly from the provided image (frame 0 identical to the selfie). Keep consistent facial identity, skin tone, hair, and key facial features. Cinematic stadium lighting, shallow depth of field, natural motion — subject dribbles forward, feints left, and finishes with a controlled shot into the corner. No fantasy elements, no added people — only realistic stadium crowd ambience.`)
  const [progress, setProgress] = useState<number>(0)
  const [overlayUrl, setOverlayUrl] = useState<string | null>(null)

  async function submitJob() {
    if (!photo) return alert('take a photo first')
    if (!email) return alert('enter your email')
    setStatus('Uploading selfie...')
    setProgress(5)

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
  // send both hosted URL and the data-uri so Runway can use either hosted or data input
  const createResp = await fetch('/api/create-job-async', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageUrl, imageDataUri: photo, prompt, duration: 5 }) })
    const createData = await createResp.json()
    if (!createData?.ok || !createData?.id) return setStatus('Failed to start job: ' + (createData?.error || JSON.stringify(createData)))
    const id = createData.id
  setStatus('Job started, polling status...')
  setProgress(20)

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
  // rough progress estimate from logs/status
  setProgress((p) => Math.min(95, p + 8))
      if (s.status === 'succeeded' || s.state === 'succeeded') break
      if (s.status === 'failed' || s.state === 'failed') return setStatus('Job failed')
    }

  setStatus('Finalizing prediction and uploading video...')
  setProgress(95)
    const finResp = await fetch('/api/finalize-prediction', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    const fin = await finResp.json()
    if (!fin?.ok || !fin?.publicId) return setStatus('Finalize failed: ' + JSON.stringify(fin))

  setStatus('Creating overlay URL...')
  setProgress(98)
    const logoPublicId = process.env.NEXT_PUBLIC_CLOUDINARY_LOGO_ID || 'Icon_uu7a2w'
    const procResp = await fetch('/api/process-video', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ videoPublicId: fin.publicId, logoPublicId }) })
    const procData = await procResp.json()
    if (!procData?.url) return setStatus('Failed to create overlay URL')

    // save overlay url for preview; user can review before sending
    setOverlayUrl(procData.url)
    setStatus('Preview ready — review below and press Send email to deliver')
    setProgress(100)
  }

  async function sendEmailNow() {
    if (!overlayUrl) return alert('No preview available')
    setStatus('Sending email...')
    const emailResp = await fetch('/api/email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: email, videoUrl: overlayUrl }) })
    const emailData = await emailResp.json()
    if (emailData?.ok) setStatus('Email sent! Check your inbox (or spam).')
    else setStatus('Email failed: ' + JSON.stringify(emailData))
  }

  return (
    <div className="flex items-center justify-center">
      <div className="w-full max-w-xl bg-white rounded-xl p-6 shadow-lg">
        <div className="flex flex-col items-center gap-4">
          <video ref={videoRef} className="w-72 h-72 rounded bg-black" />

          <div className="flex gap-3">
            <button onClick={startCamera} className="px-4 py-2 bg-brand-teal text-white rounded font-semibold">Start Camera</button>
            <button onClick={takePhoto} className="px-4 py-2 bg-brand-teal-2 text-white rounded font-semibold">Take Photo</button>
          </div>

          {photo && (
            <div className="flex flex-col items-center">
              <h3 className="font-semibold">Selfie</h3>
              <img src={photo} alt="preview" className="w-40 h-40 object-cover rounded-full border-4 border-brand-neutral" />
            </div>
          )}

          {/* reference video removed — selfie used as starting frame */}

          <div className="w-full">
            <label className="block mb-1">Your email</label>
            <input
              className="block border p-2 rounded w-full"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitJob() }}
              placeholder="you@example.com"
            />
          </div>

          <div className="w-full">
            <button onClick={submitJob} className="w-full mt-1 px-4 py-2 bg-brand-dark text-white rounded font-semibold">Create Video & Preview</button>
          </div>

          <div className="w-full">
            <div className="w-full bg-brand-neutral rounded-full h-2 overflow-hidden">
              <div className="h-2 bg-brand-teal" style={{ width: `${progress}%` }} />
            </div>
          </div>

          {status && <div className="mt-2 text-sm text-center">{status}</div>}

          {overlayUrl && (
            <div className="mt-4 w-full text-center">
              <h4 className="font-semibold mb-2">Preview result</h4>
              <video src={overlayUrl} controls className="w-full rounded-md bg-black" />
              <div className="mt-3 flex gap-2 justify-center">
                <button onClick={sendEmailNow} className="px-4 py-2 bg-brand-teal text-white rounded font-semibold">Send Email</button>
                <a href={overlayUrl} target="_blank" rel="noreferrer" className="px-4 py-2 bg-brand-neutral text-brand-dark rounded">Open in new tab</a>
              </div>
            </div>
          )}
        </div>
      </div>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  )
}
