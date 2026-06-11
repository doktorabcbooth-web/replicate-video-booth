"use client"

import { useRef, useState, useCallback, useEffect } from 'react'

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
        alert('Kamera konnte nicht gestartet werden: ' + String(fallbackErr))
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
    const videoWidth = videoRef.current.videoWidth
    const videoHeight = videoRef.current.videoHeight
    
    // Resize photo to keep payload small and fast to upload
    const maxDim = 1024
    let width = videoWidth
    let height = videoHeight
    if (width > maxDim || height > maxDim) {
      if (width > height) {
        height = Math.round((height * maxDim) / width)
        width = maxDim
      } else {
        width = Math.round((width * maxDim) / height)
        height = maxDim
      }
    }

    canvasRef.current.width = width
    canvasRef.current.height = height
    ctx.drawImage(videoRef.current, 0, 0, width, height)
    const data = canvasRef.current.toDataURL('image/jpeg', 0.85)
    setPhoto(data)
    setStatus('📸 Foto aufgenommen!')
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
    setStatus('Foto wird komprimiert...')

    const reader = new FileReader()
    reader.onloadend = () => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const maxDim = 1024
        let width = img.width
        let height = img.height

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width)
            width = maxDim
          } else {
            width = Math.round((width * maxDim) / height)
            height = maxDim
          }
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height)
          // Compress to JPEG with 0.85 quality
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85)
          setPhoto(compressedDataUrl)
          setStatus('📸 Foto hochgeladen & optimiert!')
        } else {
          setPhoto(reader.result as string)
          setStatus('📸 Foto ausgewählt!')
        }
      }
      img.onerror = (err) => {
        console.error('Image loading/decoding failed, falling back to original data URL', err)
        setPhoto(reader.result as string)
        setStatus('📸 Foto ausgewählt!')
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
    // Clear input value so selecting the same file triggers change handler again
    e.target.value = ''
  }

  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [progress, setProgress] = useState<number>(0)
  const [overlayUrl, setOverlayUrl] = useState<string | null>(null)

  // ── Quiz CAPTCHA ──
  type QuizQuestion = {
    question: string
    options: string[]
    answer: string
  }

  const quizPool: QuizQuestion[] = [
    { question: 'Welches Emoji passt nicht zu den anderen?', options: ['🍎', '🍌', '🍇', '🧦'], answer: '🧦' },
    { question: 'Welches Emoji passt nicht zu den anderen?', options: ['🌧️', '☂️', '🍰', '🌧️'], answer: '🍰' },
    { question: 'Klicke auf den Vogel.', options: ['🐱', '🐦', '🐶', '🐸'], answer: '🐦' },
    { question: 'Klicke auf das Musikinstrument.', options: ['🎸', '🧢', '👟', '🧱'], answer: '🎸' },
    { question: 'Welche Farbe hat typischerweise Gras?', options: ['🟥 Rot', '🟩 Grün', '⬛ Schwarz'], answer: '🟩 Grün' },
    { question: 'Welche Farbe hat ein klassischer Feuerwehrwagen?', options: ['🟦 Blau', '🟥 Rot', '🟨 Gelb'], answer: '🟥 Rot' },
    { question: 'Was kommt als Nächstes? 2 → 4 → 6 → ?', options: ['7', '8', '10', '5'], answer: '8' },
    { question: 'Welche Zahl fehlt? 5, 4, 3, 2, ?', options: ['0', '1', '3', '6'], answer: '1' },
    { question: 'Bitte wähle das Tier aus:', options: ['Tisch', 'Lampe', 'Hund', 'Stuhl'], answer: 'Hund' },
    { question: 'Bitte wähle das Getränk aus:', options: ['Wasser', 'Schuhe', 'Fenster', 'Kabel'], answer: 'Wasser' },
    { question: 'Welches ist kein Obst?', options: ['🍓', '🍍', '🍊', '🧀'], answer: '🧀' },
    { question: 'Welches ist kein Tier?', options: ['🐭', '🐘', '🥕', '🐼'], answer: '🥕' },
    { question: 'Welches davon ist kein Festival-Accessoire?', options: ['🎧', '🎫', '🎵', '🧻'], answer: '🧻' },
    { question: 'Welche der folgenden Optionen ist ein Wochentag?', options: ['Juli', 'Montag', 'Winter', '2026'], answer: 'Montag' },
    { question: 'Bitte wähle die Stadt aus:', options: ['Banane', 'Auto', 'Berlin', 'Katze'], answer: 'Berlin' },
    { question: 'Welcher Pfeil zeigt nach oben?', options: ['⬅️', '⬆️', '➡️', '⬇️'], answer: '⬆️' },
    { question: 'Welche dieser Optionen ist eine Tageszeit?', options: ['Morgen', 'Banane', 'Tisch', 'Regen'], answer: 'Morgen' },
    { question: 'Welche Form hat drei Seiten?', options: ['⚪ Kreis', '🔺 Dreieck', '⬛ Quadrat'], answer: '🔺 Dreieck' },
    { question: 'Welche Gruppe enthält genau drei Symbole?', options: ['😀 😀', '😀 😀 😀', '😀 😀 😀 😀'], answer: '😀 😀 😀' },
    { question: 'Welche Option beschreibt etwas, das man essen kann?', options: ['Wolke', 'Stein', 'Brot', 'Schuhe'], answer: 'Brot' },
  ]

  const [activeQuestions, setActiveQuestions] = useState<QuizQuestion[]>([])
  const [selectedAnswers, setSelectedAnswers] = useState<(string | null)[]>([null, null])
  const [captchaError, setCaptchaError] = useState(false)

  const generateCaptcha = useCallback(() => {
    const shuffled = [...quizPool].sort(() => Math.random() - 0.5)
    setActiveQuestions([shuffled[0], shuffled[1]])
    setSelectedAnswers([null, null])
    setCaptchaError(false)
  }, [])

  useEffect(() => { generateCaptcha() }, [generateCaptcha])

  function selectAnswer(questionIndex: number, option: string) {
    setSelectedAnswers(prev => {
      const next = [...prev]
      next[questionIndex] = option
      return next
    })
    setCaptchaError(false)
  }

  async function submitJob() {
    if (!photo) return alert('Bitte machen oder laden Sie zuerst ein Foto hoch')
    if (!email) return alert('Bitte geben Sie Ihre E-Mail-Adresse ein')

    // Simple email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return alert('Bitte geben Sie eine gültige E-Mail-Adresse ein')
    }

    // CAPTCHA check – both questions must be answered correctly
    if (
      activeQuestions.length < 2 ||
      selectedAnswers[0] !== activeQuestions[0].answer ||
      selectedAnswers[1] !== activeQuestions[1].answer
    ) {
      setCaptchaError(true)
      generateCaptcha()
      return
    }

    setStatus('Foto wird hochgeladen...')
    setProgress(5)

    // Extract base64 from data URI (format: data:image/jpeg;base64,BASE64_DATA)
    const b64 = photo.split(',')[1]
    if (!b64) return setStatus('Fehler beim Codieren des Fotos')
    
    console.log('Uploading with filename:', `photo-${Date.now()}.jpg`, 'b64 length:', b64.length)
    
    const photoFilename = `photo-${Date.now()}.jpg`
    let photoUrl = ''
    try {
      const uploadResp = await fetch('/api/upload-to-supabase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: photoFilename, b64, contentType: 'image/jpeg' })
      })
      
      const uploadData = await uploadResp.json()
      if (!uploadData?.ok) {
        console.error('Upload failed:', uploadData)
        return setStatus('Fehler beim Hochladen des Fotos: ' + (uploadData?.error || 'unbekannt'))
      }
      photoUrl = uploadData.publicUrl
      setStatus('Foto hochgeladen! Videogenerierung wird gestartet...')
      setProgress(10)
    } catch (uploadErr: any) {
      console.error('Upload error:', uploadErr)
      return setStatus('Fehler beim Hochladen des Fotos: ' + (uploadErr.message || 'Verbindungsfehler'))
    }

    // Start background processing pipeline
    try {
      const startResp = await fetch('/api/start-process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: photoUrl, email })
      })
      const startData = await startResp.json()
      if (!startResp.ok || !startData?.ok || !startData?.leadId) {
        return setStatus('Prozessstart fehlgeschlagen: ' + (startData?.error || 'unbekannt'))
      }

      const leadId = startData.leadId
      setStatus('🎥 Video wird im Hintergrund erstellt! Du kannst dieses Fenster jetzt schließen – wir senden dir das Video per E-Mail in 2 bis 5 Minuten zu.')
      setProgress(15)

      // Simulate UI progress bar while polling
      let currentProgress = 15
      const progressInterval = setInterval(() => {
        currentProgress = Math.min(95, currentProgress + Math.random() * 2)
        setProgress(Math.floor(currentProgress))
      }, 2000)

      // Poll status endpoint
      const pollInterval = setInterval(async () => {
        try {
          const sResp = await fetch(`/api/job-status?leadId=${encodeURIComponent(leadId)}`)
          if (!sResp.ok) return
          const s = await sResp.json()
          if (s.status === 'completed' && s.videoUrl) {
            clearInterval(progressInterval)
            clearInterval(pollInterval)
            setOverlayUrl(s.videoUrl)
            setProgress(100)
            setStatus('✅ Video bereit & E-Mail gesendet! Überprüfen Sie Ihren Posteingang.')
            setEmailSent(true)
          } else if (s.status === 'failed') {
            clearInterval(progressInterval)
            clearInterval(pollInterval)
            setStatus('❌ Videogenerierung fehlgeschlagen. Bitte versuchen Sie es mit einem anderen Foto erneut.')
          }
        } catch (pollErr) {
          console.error('Polling error:', pollErr)
        }
      }, 3000)

    } catch (err: any) {
      console.error('Start process error:', err)
      setStatus('Prozessstart fehlgeschlagen: ' + (err.message || 'Verbindungsfehler'))
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
                  Foto von Ihrem Freund machen
                </button>
                <label className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'var(--brand-neutral)', color: 'var(--brand-dark)' }}>
                  Ihr Foto hochladen
                  <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
                </label>
              </>
            ) : (
              <>
                <button onClick={takePhoto} className="btn btn-primary">Foto aufnehmen</button>
                <button onClick={() => {
                  const stream = videoRef.current?.srcObject as MediaStream | null
                  if (stream) stream.getTracks().forEach(track => track.stop())
                  setCameraStarted(false)
                }} className="btn btn-primary" style={{ background: '#e5e9f0', color: 'var(--brand-dark)' }}>Abbrechen</button>
              </>
            )}
          </div>
        </div>

        {/* ── Status ── */}
        {status && (
          <div className="status-text" style={{ textAlign: 'center', fontSize: '14px', fontWeight: 500, padding: '12px 0' }}>
            {status}
          </div>
        )}

        {/* ── Selected Photo Preview ── */}
        {photo && (
          <div className="preview-wrap">
            <p className="section-label">Ihr Foto</p>
            <div className="preview-avatar">
              <img src={photo} alt="Your photo" />
            </div>
          </div>
        )}

        {/* ── Email Input ── */}
        <div className="form-block">
          <label>Ihre E-Mail-Adresse</label>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submitJob() }}
            placeholder="ihre-email@beispiel.de"
          />
        </div>

        {/* ── CAPTCHA Quiz ── */}
        <div className="captcha-block">
          <div className="captcha-header">
            <label className="captcha-label">🛡️ Sicherheitsfragen</label>
            <button type="button" className="captcha-refresh" onClick={generateCaptcha} title="Neue Fragen">
              ↻
            </button>
          </div>
          {activeQuestions.map((q, qi) => (
            <div key={qi} className="captcha-quiz">
              <p className="captcha-question">{q.question}</p>
              <div className="captcha-options">
                {q.options.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    className={`captcha-opt${selectedAnswers[qi] === opt ? ' selected' : ''}`}
                    onClick={() => selectAnswer(qi, opt)}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {captchaError && (
            <p className="captcha-error">❌ Falsche Antwort – bitte versuche es erneut.</p>
          )}
        </div>

        {/* ── CTA ── */}
        <button onClick={submitJob} className="cta">Video erstellen &amp; Vorschau</button>

        {/* ── Progress ── */}
        <div className="progress-track">
          <div className="progress-bar" style={{ width: `${progress}%` }} />
        </div>



        {/* ── Result Preview ── */}
        {overlayUrl && (
          <div className="result-preview">
            <p className="section-label">Vorschau des Ergebnisses</p>
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
                Video herunterladen
              </a>
              <a href={overlayUrl} target="_blank" rel="noreferrer" className="btn-link">In neuem Tab öffnen</a>
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
            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--brand-dark)' }}>E-Mail gesendet!</h3>
            <p style={{ margin: 0, fontSize: '14px', color: 'rgba(11, 11, 18, 0.7)', lineHeight: 1.5 }}>
              Überprüfen Sie Ihren Posteingang (oder Spam-Ordner). Ihr persönliches DoctorABC-Weltmeisterschaftsvideo ist auf dem Weg!
            </p>
            <button onClick={() => setEmailSent(false)} className="btn btn-primary" style={{ marginTop: '10px', width: '100%' }}>
              Großartig, danke!
            </button>
          </div>
        </div>
      )}

      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </>
  )
}
