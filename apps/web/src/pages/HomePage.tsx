import { useNavigate } from 'react-router-dom'
import { Mic, FileText, Globe, Youtube, Video, Headphones, History, Settings } from 'lucide-react'

const SOURCE_TABS = [
  { kind: 'live',    label: 'Live recording', icon: <Mic size={15} />,        route: '/live' },
  { kind: 'youtube', label: 'YouTube',         icon: <Youtube size={15} />,    route: '/import/youtube' },
  { kind: 'pdf',     label: 'PDF',             icon: <FileText size={15} />,   route: '/import/pdf' },
  { kind: 'web',     label: 'Website',         icon: <Globe size={15} />,      route: '/import/web' },
  { kind: 'video',   label: 'Video / Audio',   icon: <Video size={15} />,      route: '/import/video' },
  { kind: 'audio',   label: 'Audio file',      icon: <Headphones size={15} />, route: '/import/audio' },
]

export default function HomePage() {
  const navigate = useNavigate()
  const activeKind = 'live'

  return (
    <main className="min-h-screen bg-bg flex flex-col items-center pt-16 px-6">
      <div className="w-full max-w-content flex justify-end gap-4 mb-6">
        <button
          onClick={() => navigate('/sessions')}
          className="flex items-center gap-1.5 text-small text-text-2 hover:text-text transition-colors"
        >
          <History size={15} />
          Sessions
        </button>
        <button
          onClick={() => navigate('/settings')}
          className="flex items-center gap-1.5 text-small text-text-2 hover:text-text transition-colors"
        >
          <Settings size={15} />
          Settings
        </button>
      </div>
      <h1 className="text-display mb-2">Import sources</h1>
      <p className="text-body text-text-2 mb-8">Choose how you want to add content</p>

      {/* Tab navigation */}
      <nav className="flex flex-wrap gap-1 bg-surface border border-border rounded-full p-1 mb-10">
        {SOURCE_TABS.map((tab) => (
          <button
            key={tab.kind}
            onClick={() => navigate(tab.route)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-small font-medium
                        transition-colors select-none
                        ${tab.kind === activeKind
                          ? 'bg-primary text-white'
                          : 'text-text-2 hover:text-text hover:bg-surface-2'
                        }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Live recording CTA */}
      <div className="card w-full max-w-content space-y-4">
        <div>
          <h2 className="text-heading font-semibold">Live Recording</h2>
          <p className="text-small text-text-2 mt-1">
            Record meetings in real-time. Supports mic + system audio. Auto speaker detection,
            auto language detection. Generates meeting minutes after you stop.
          </p>
        </div>

        <div className="flex flex-col gap-2 text-small text-text-2">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-accent" />
            Real-time transcript with speaker labels
          </div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-accent" />
            Two-pass processing for accurate diarization
          </div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-accent" />
            Meeting minutes with action items
          </div>
        </div>

        <button
          onClick={() => navigate('/live')}
          className="btn-primary flex items-center justify-center gap-2 w-full py-3"
        >
          <Mic size={16} />
          Start Recording
        </button>
      </div>
    </main>
  )
}
