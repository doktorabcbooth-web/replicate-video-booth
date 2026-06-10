import CameraCapture from './components/CameraCapture'

export default function Home() {
  return (
    <div className="wrapper">
      <div className="topbar">
        <div className="logo-pill">
          <img
            src="https://res.cloudinary.com/do4hqtjxb/image/upload/v1779910689/Icon_uu7a2w.png"
            alt="DoktorABC logo"
            width={34}
            height={34}
          />
          <div className="logo-text">DOKTORABC</div>
        </div>
        <h1 className="title">Video-Booth</h1>
        <p className="subtitle">Erstelle ein KI-Video von dir und gewinne ein iPhone 17 Pro Max.</p>
      </div>

      <CameraCapture />
    </div>
  )
}
