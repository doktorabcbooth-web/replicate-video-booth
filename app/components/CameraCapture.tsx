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
    setStatus('📸 Photo taken!')
    setProgress(0)
  }

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    // Stop any running camera stream
    const currentStream = videoRef.current?.srcObject as MediaStream | null
    if (currentStream) currentStream.getTracks().forEach(track => track.stop())
    setCameraStarted(false)
    setProgress(0)
    setOverlayUrl(null)
    setEmailSent(false)
    const reader = new FileReader()
    reader.onloadend = () => {
      setPhoto(reader.result as string)
      setStatus('📸 Photo selected!')
    }
    reader.readAsDataURL(file)
  }

  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [progress, setProgress] = useState<number>(0)
  const [overlayUrl, setOverlayUrl] = useState<string | null>(null)

  async function submitJob() {
    if (!photo) return alert('Please capture or upload a photo first')
    if (!email) return alert('enter your email')
    setStatus('Uploading photo...')
    setProgress(5)

    // Extract base64 from data URI (format: data:image/jpeg;base64,BASE64_DATA)
    const b64 = photo.split(',')[1]
    if (!b64) return setStatus('Failed to encode photo')
    
    console.log('Uploading with filename:', `photo-${Date.now()}.jpg`, 'b64 length:', b64.length)
    
    const photoFilename = `photo-${Date.now()}.jpg`
    const uploadResp = await fetch('/api/upload-to-supabase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: photoFilename, b64, contentType: 'image/jpeg' })
    })
    
    console.log('Upload response status:', uploadResp.status)
    
    const uploadData = await uploadResp.json()
    console.log('Upload response data:', uploadData)
    
    if (!uploadData?.ok) {
      console.error('Upload failed:', uploadData)
      return setStatus('Failed to upload photo: ' + (uploadData?.error || 'unknown'))
    }
    setStatus('Photo uploaded')
    const photoUrl = uploadData.publicUrl
    setProgress(10)

    // ── Step 1: GPT Image – composite photo into footballer ──
    setStatus('Creating your football player image...')
    const gptResp = await fetch('/api/create-gpt-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrl: photoUrl })
    })
    const gptData = await gptResp.json()
    if (!gptData?.ok || !gptData?.id) {
      return setStatus('Failed to start image generation: ' + (gptData?.error || JSON.stringify(gptData)))
    }
    const gptId = gptData.id
    setStatus('Generating football player image...')
    setProgress(15)

    // Poll GPT Image prediction
    let gptImageUrl: string | null = null
    for (;;) {
      await new Promise((r) => setTimeout(r, 3000))
      const sResp = await fetch(`/api/prediction-status?id=${encodeURIComponent(gptId)}`)
      const s = await sResp.json()
      if (s.logs) setStatus(`Creating player image — ${s.status || ''} — ${s.logs.split('\n').slice(-2).join(' | ')}`)
      else setStatus(`Creating player image — ${s.status || ''}`)
      setProgress((p) => Math.min(45, p + 5))
      if (s.status === 'succeeded' || s.state === 'succeeded') {
        // GPT Image output is an array of URLs
        const output = s.output
        gptImageUrl = Array.isArray(output) ? output[0] : output
        break
      }
      if (s.status === 'failed' || s.state === 'failed') {
        return setStatus('Image generation failed\n\nError: ' + (s.error || JSON.stringify(s)))
      }
    }

    if (!gptImageUrl) return setStatus('No image URL returned from GPT Image')
    setStatus('Football player image ready! Starting video generation...')
    setProgress(50)

    // ── Step 2: Seedance – generate video from GPT image ──
    const createResp = await fetch('/api/create-job-async', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrl: gptImageUrl, duration: 5 })
    })
    const createData = await createResp.json()
    if (!createData?.ok || !createData?.id) {
      return setStatus('Failed to start video job: ' + (createData?.error || JSON.stringify(createData)))
    }
    const id = createData.id
    setStatus('Video job started, generating...')
    setProgress(55)

    // Poll Seedance prediction
    for (;;) {
      await new Promise((r) => setTimeout(r, 3000))
      const sResp = await fetch(`/api/prediction-status?id=${encodeURIComponent(id)}`)
      const s = await sResp.json()
      if (s.logs) setStatus(`Generating video — ${s.status || ''} — ${s.logs.split('\n').slice(-2).join(' | ')}`)
      else setStatus(`Generating video — ${s.status || ''}`)
      setProgress((p) => Math.min(95, p + 5))
      if (s.status === 'succeeded' || s.state === 'succeeded') break
      if (s.status === 'failed' || s.state === 'failed') {
        return setStatus('Video generation failed\n\nError: ' + (s.error || JSON.stringify(s)))
      }
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

    setOverlayUrl(procData.url)
    setProgress(100)

    // Auto-send email
    setStatus('Sending email...')
    try {
      const emailResp = await fetch('/api/email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: email, videoUrl: procData.url }) })
      const emailData = await emailResp.json()
      if (emailData?.ok) {
        setStatus('✅ Video ready & email sent! Check your inbox.')
        setEmailSent(true)
      } else {
        setStatus('⚠️ Video ready but email failed: ' + JSON.stringify(emailData))
      }
    } catch (emailErr) {
      setStatus('⚠️ Video ready but email failed: ' + String(emailErr))
    }
  }

  const [emailSent, setEmailSent] = useState(false)

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

          <div className="button-row" style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', maxWidth: '250px' }}>
            {!cameraStarted ? (
              <>
                <button onClick={() => startCamera('environment')} className="btn btn-primary">
                  Take Photo of your Friend
                </button>
                <label className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'var(--brand-neutral)', color: 'var(--brand-dark)' }}>
                  Upload your Photo
                  <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
                </label>
              </>
            ) : (
              <>
                <button onClick={takePhoto} className="btn btn-primary">Take Photo</button>
                <button onClick={() => {
                  const stream = videoRef.current?.srcObject as MediaStream | null
                  if (stream) stream.getTracks().forEach(track => track.stop())
                  setCameraStarted(false)
                }} className="btn btn-primary" style={{ background: '#e5e9f0', color: 'var(--brand-dark)' }}>Cancel</button>
              </>
            )}
          </div>
        </div>

        {/* ── Selected Photo Preview ── */}
        {photo && (
          <div className="preview-wrap">
            <p className="section-label">Your Photo</p>
            <div className="preview-avatar">
              <img src={photo} alt="Your photo" />
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
            <div className="result-actions" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <a 
                href={overlayUrl.includes('/upload/') ? overlayUrl.replace('/upload/', '/upload/fl_attachment/') : overlayUrl} 
                download="doctorabc-football-goal.mp4" 
                className="btn btn-primary"
                style={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  textDecoration: 'none',
                  background: 'var(--brand-teal)', 
                  color: 'var(--brand-dark)' 
                }}
              >
                Download Video
              </a>
              <a href={overlayUrl} target="_blank" rel="noreferrer" className="btn-link">Open in new tab</a>
            </div>
          </div>
        )}
      </section>

      {/* ── Email Confirmation Popup Modal ── */}
      {emailSent && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(13, 44, 84, 0.65)',
          backdropFilter: 'blur(8px)',
          display: 'grid',
          placeItems: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '24px',
            padding: '30px',
            width: '100%',
            maxWidth: '400px',
            textAlign: 'center',
            boxShadow: 'var(--shadow)',
            border: '1px solid rgba(13, 44, 84, 0.08)',
            display: 'grid',
            gap: '16px'
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--brand-teal), var(--brand-teal-2))',
              display: 'grid',
              placeItems: 'center',
              margin: '0 auto'
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--brand-dark)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--brand-dark)' }}>Email Sent!</h3>
            <p style={{ margin: 0, fontSize: '14px', color: 'rgba(11, 11, 18, 0.7)', lineHeight: 1.5 }}>
              Check your inbox (or spam folder). Your custom DoctorABC world cup video is on its way!
            </p>
            <button onClick={() => setEmailSent(false)} className="btn btn-primary" style={{ marginTop: '10px', width: '100%' }}>
              Great, thank you!
            </button>
          </div>
        </div>
      )}

      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </>
  )
}
