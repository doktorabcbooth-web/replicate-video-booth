import CameraCapture from './components/CameraCapture'

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">Video Booth</h1>
        <CameraCapture />
      </div>
    </main>
  )
}
