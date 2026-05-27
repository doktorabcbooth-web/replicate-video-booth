import CameraCapture from './components/CameraCapture'

export default function Home() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-full max-w-3xl p-6">
        <h1 className="text-3xl font-semibold text-brand-dark mb-4 text-center">Video Booth</h1>
        <CameraCapture />
      </div>
    </div>
  )
}
