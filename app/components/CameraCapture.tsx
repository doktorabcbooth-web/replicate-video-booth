"use client"

import { useRef, useState } from 'react'

export default function CameraCapture() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [photo, setPhoto] = useState<string | null>(null)
  const [cameraStarted, setCameraStarted] = useState(false)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user')

  async function startCamera(mode: 'user' | 'environment' = 'user') {
    if (!videoRef.current) return
    const currentStream = videoRef.current.srcObject as MediaStream | null
    if (currentStream) {
      currentStream.getTracks().forEach((track) => track.stop())
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: mode } })
      videoRef.current.srcObject = stream
      await videoRef.current.play()
      setCameraStarted(true)
      setFacingMode(mode)
    } catch (err) {
      console.error('Error starting camera:', err)
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true })
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setCameraStarted(true)
      } catch (fallbackErr) {
        alert('Could not start camera: ' + String(fallbackErr))
      }
    }
  }

  function toggleCamera() {
    const nextMode = facingMode === 'user' ? 'environment' : 'user'
    startCamera(nextMode)
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

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onloadend = () => {
      setPhoto(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [progress, setProgress] = useState<number>(0)
  const [overlayUrl, setOverlayUrl] = useState<string | null>(null)

  async function submitJob() {
    if (!photo) return alert('take a photo first')
    if (!email) return alert('enter your email')
    setStatus('Uploading selfie...')
    setProgress(5)

    // Extract base64 from data URI (format: data:image/jpeg;base64,BASE64_DATA)
    const b64 = photo.split(',')[1]
    if (!b64) return setStatus('Failed to encode selfie')
    
    console.log('Uploading with filename:', `selfie-${Date.now()}.jpg`, 'b64 length:', b64.length)
    
    const selfieFilename = `selfie-${Date.now()}.jpg`
    const uploadResp = await fetch('/api/upload-to-supabase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: selfieFilename, b64, contentType: 'image/jpeg' })
    })
    
    console.log('Upload response status:', uploadResp.status)
    
    const uploadData = await uploadResp.json()
    console.log('Upload response data:', uploadData)
    
    if (!uploadData?.ok) {
      console.error('Upload failed:', uploadData)
      return setStatus('Failed to upload selfie: ' + (uploadData?.error || 'unknown'))
    }
    setStatus('Selfie uploaded')
    const imageUrl = uploadData.publicUrl

    setStatus('Starting Seedance job...')
    // Use async create endpoint so browser doesn't block
    // Only send the hosted imageUrl (from Supabase), not the huge data URI
    const createResp = await fetch('/api/create-job-async', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageUrl, duration: 5 }) })
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
    <>
      <section className="card">
        {/* ── Camera ── */}
        <div className="camera-shell">
          <div className="camera-stage">
            <div className="camera-view">
              <video ref={videoRef} playsInline muted style={cameraStarted ? { display: 'block' } : { display: 'none' }} />
              {!cameraStarted && (
                <div className="portrait-placeholder" aria-hidden="true" />
              )}
            </div>
          </div>

          <div className="button-row" style={{ gridTemplateColumns: cameraStarted ? '1fr 1fr' : '1fr', width: '100%', maxWidth: '250px' }}>
            {!cameraStarted ? (
              <button onClick={() => startCamera('user')} className="btn btn-primary">Start Camera</button>
            ) : (
              <>
                <button onClick={takePhoto} className="btn btn-primary">Take Photo</button>
                <button onClick={toggleCamera} className="btn btn-primary" style={{ background: 'var(--brand-dark)', color: '#fff' }}>Switch Camera</button>
              </>
            )}
          </div>

          <div style={{ width: '100%', maxWidth: '250px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {cameraStarted && (
              <button onClick={() => {
                const stream = videoRef.current?.srcObject as MediaStream | null
                if (stream) stream.getTracks().forEach(track => track.stop())
                setCameraStarted(false)
              }} className="btn btn-primary" style={{ background: '#e5e9f0', color: 'var(--brand-dark)' }}>Stop Camera</button>
            )}
            <label className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'var(--brand-neutral)', color: 'var(--brand-dark)' }}>
              Upload Image
              <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
            </label>
          </div>
        </div>

        {/* ── Selfie Preview ── */}
        {photo && (
          <div className="preview-wrap">
            <p className="section-label">Selfie</p>
            <div className="preview-avatar">
              <img src={photo} alt="Your selfie" />
            </div>
          </div>
        )}

        {/* ── Email Input ── */}
        <div className="form-block">
          <label>Your email</label>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submitJob() }}
            placeholder="you@example.com"
          />
        </div>

        {/* ── CTA ── */}
        <button onClick={submitJob} className="cta">Create Video &amp; Preview</button>

        {/* ── Progress ── */}
        <div className="progress-track">
          <div className="progress-bar" style={{ width: `${progress}%` }} />
        </div>

        {/* ── Status ── */}
        {status && <div className="status-text">{status}</div>}

        {/* ── Result Preview ── */}
        {overlayUrl && (
          <div className="result-preview">
            <p className="section-label">Preview result</p>
            <video src={overlayUrl} controls playsInline />
            <div className="result-actions">
              <button onClick={sendEmailNow} className="btn-send">Send Email</button>
              <a href={overlayUrl} target="_blank" rel="noreferrer" className="btn-link">Open in new tab</a>
            </div>
          </div>
        )}
      </section>

      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </>
  )
}
