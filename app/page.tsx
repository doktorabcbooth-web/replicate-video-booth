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
        <h1 className="title">⚽️ Gewinne ein iPhone 17 Pro Max 🏆</h1>
        <div className="marquee-container">
          <div className="marquee-content">
            <span className="marquee-text">⚽️🏆📱 Lade ein Foto hoch, erhalte dein Video und die Chance auf den Hauptgewinn! ⚽️🏆📱</span>
            <span className="marquee-text">⚽️🏆📱 Lade ein Foto hoch, erhalte dein Video und die Chance auf den Hauptgewinn! ⚽️🏆📱</span>
          </div>
        </div>
      </div>

      <CameraCapture />
    </div>
  )
}
