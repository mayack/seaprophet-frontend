'use client'

import React, { useEffect, useRef, useState } from 'react'
import Hls from 'hls.js'

const REFERER = 'https://www.surfline.com/'

const STREAMS = [
  {
    label: 'Anchor Point (MA)',
    url: 'https://hls.cdn-surfline.com/ireland/ma-anchorpointmadraba/playlist.m3u8',
  },
  {
    label: 'Arrifana (PT)',
    url: 'https://hls.cdn-surfline.com/ireland/pt-arrifana/playlist.m3u8',
  },
  {
    label: 'Almagreira (PT)',
    url: 'https://hls.cdn-surfline.com/ireland/pt-almagreira/playlist.m3u8',
  },
]

function proxyUrl(rawUrl: string): string {
  return `/api/proxy?url=${encodeURIComponent(rawUrl)}&referer=${encodeURIComponent(REFERER)}`
}

export default function TestStreamPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const [activeIdx, setActiveIdx] = useState(0)
  const [status, setStatus] = useState('Initializing...')
  const [logs, setLogs] = useState<string[]>([])

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString()
    setLogs((prev) => [...prev.slice(-50), `[${time}] ${msg}`])
  }

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    if (!Hls.isSupported()) {
      setStatus('HLS not supported in this browser')
      return
    }

    // Tear down previous instance
    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }

    const stream = STREAMS[activeIdx]
    const src = proxyUrl(stream.url)
    const origin = window.location.origin

    const hls = new Hls({
      xhrSetup: (xhr, url) => {
        if (
          url.startsWith('/api/proxy') ||
          url.startsWith(`${origin}/api/proxy`)
        ) {
          xhr.open('GET', url, true)
          return
        }
        xhr.open('GET', proxyUrl(url), true)
      },
    })

    hlsRef.current = hls

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      setStatus('Playing')
      addLog('Manifest parsed OK')
      video.play().catch(() => {})
    })

    hls.on(Hls.Events.ERROR, (_event, data) => {
      const url = data.url || ''
      const code = data.response?.code ?? 'n/a'
      const text = data.response?.text ?? ''
      addLog(`HLS error: ${data.details} | HTTP ${code} | ${url}`)
      if (text) addLog(`  response: ${text.substring(0, 200)}`)
      if (data.fatal) {
        setStatus(`Fatal error: ${data.details}`)
        if (data.details === 'fragLoadError') {
          hls.startLoad()
        }
      }
    })

    hls.on(Hls.Events.FRAG_LOADED, () => {
      addLog('Segment loaded')
    })

    setLogs([])
    addLog(`Switched to: ${stream.label}`)
    addLog(`Loading: ${src}`)
    setStatus('Loading...')
    hls.loadSource(src)
    hls.attachMedia(video)

    return () => {
      hls.destroy()
      hlsRef.current = null
    }
  }, [activeIdx])

  return (
    <div className="min-h-screen bg-gray-950 p-6 text-white">
      <h1 className="mb-4 text-xl font-bold">Stream Proxy Test</h1>

      {/* Stream switcher */}
      <div className="mb-4 flex gap-2">
        {STREAMS.map((s, i) => (
          <button
            key={s.url}
            onClick={() => setActiveIdx(i)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              i === activeIdx
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <p className="mb-3 font-mono text-xs text-gray-400 break-all">
        {STREAMS[activeIdx].url}
      </p>

      <div className="mb-4 overflow-hidden rounded-lg bg-black">
        <video
          ref={videoRef}
          className="size-full max-h-[480px]"
          playsInline
          muted
          controls
        />
      </div>

      <p className="mb-3 text-sm">
        Status: <span className="font-semibold">{status}</span>
      </p>

      <div className="rounded-lg bg-gray-900 p-3">
        <p className="mb-2 text-xs font-semibold text-gray-400 uppercase">
          Log
        </p>
        <pre className="max-h-60 overflow-auto text-xs text-gray-300">
          {logs.join('\n') || 'Waiting...'}
        </pre>
      </div>
    </div>
  )
}
