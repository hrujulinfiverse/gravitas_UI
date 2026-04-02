import { useState, useRef } from 'react'
import { BASE_URL } from '../lib/apiConfig'

/**
 * Cleans raw legal text so it reads naturally when spoken aloud.
 * Removes separator lines, markdown symbols, and other visual-only formatting.
 */
function cleanTextForTTS(raw) {
  if (!raw) return ''
  return raw
    // Remove lines that are only repeated symbols (===, ---, ***, ___) with 3+ chars
    .replace(/^[=\-*_#~]{3,}\s*$/gm, '')
    // Remove markdown headers (##, ###, etc.)
    .replace(/^#{1,6}\s+/gm, '')
    // Remove bullet points and list markers
    .replace(/^[\*\-\+]\s+/gm, '')
    // Remove numbered list markers like "1." or "1)"
    .replace(/^\d+[\.\)]\s+/gm, '')
    // Replace "|" table separators with commas
    .replace(/\|/g, ', ')
    // Remove backtick code formatting
    .replace(/`[^`]*`/g, '')
    // Collapse 3+ newlines into 2 (a natural pause)
    .replace(/\n{3,}/g, '\n\n')
    // Collapse multiple spaces
    .replace(/ {2,}/g, ' ')
    // Trim each line
    .split('\n').map(l => l.trim()).join('\n')
    // Final trim
    .trim()
}

/**
 * AudioButton — A premium TTS button component.
 *
 * Props:
 *   text       (string)  — The text to be converted to speech
 *   language   (string)  — Language code, default "en"
 *   label      (string)  — Optional custom label, default "Listen"
 */
export default function AudioButton({ text, language = 'en', label = 'Listen' }) {
  const [status, setStatus] = useState('idle') // idle | loading | playing | error
  const audioRef = useRef(null)

  const handleClick = async () => {
    // If already playing, stop
    if (status === 'playing' && audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      setStatus('idle')
      return
    }

    if (!text || !text.trim()) return

    setStatus('loading')

    try {
      const response = await fetch(`${BASE_URL}/nyaya/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cleanTextForTTS(text).slice(0, 1500), language })
      })

      if (!response.ok) {
        throw new Error(`TTS request failed: ${response.statusText}`)
      }

      const blob = await response.blob()
      const audioUrl = URL.createObjectURL(blob)

      if (audioRef.current) {
        audioRef.current.pause()
        URL.revokeObjectURL(audioRef.current.src)
      }

      const audio = new Audio(audioUrl)
      audioRef.current = audio

      audio.onended = () => {
        setStatus('idle')
        URL.revokeObjectURL(audioUrl)
      }
      audio.onerror = () => {
        setStatus('error')
        URL.revokeObjectURL(audioUrl)
      }

      await audio.play()
      setStatus('playing')
    } catch (err) {
      console.error('TTS Error:', err)
      setStatus('error')
      setTimeout(() => setStatus('idle'), 3000)
    }
  }

  const getIcon = () => {
    switch (status) {
      case 'loading': return '⏳'
      case 'playing': return '⏹️'
      case 'error': return '⚠️'
      default: return '🔊'
    }
  }

  const getLabel = () => {
    switch (status) {
      case 'loading': return 'Generating...'
      case 'playing': return 'Stop'
      case 'error': return 'TTS Error'
      default: return label
    }
  }

  const getBgColor = () => {
    switch (status) {
      case 'playing': return 'rgba(239, 68, 68, 0.15)'
      case 'error': return 'rgba(245, 158, 11, 0.15)'
      case 'loading': return 'rgba(255, 255, 255, 0.05)'
      default: return 'rgba(102, 126, 234, 0.12)'
    }
  }

  const getBorderColor = () => {
    switch (status) {
      case 'playing': return 'rgba(239, 68, 68, 0.4)'
      case 'error': return 'rgba(245, 158, 11, 0.4)'
      case 'loading': return 'rgba(255, 255, 255, 0.15)'
      default: return 'rgba(102, 126, 234, 0.35)'
    }
  }

  const getTextColor = () => {
    switch (status) {
      case 'playing': return '#ef4444'
      case 'error': return '#f59e0b'
      case 'loading': return 'rgba(255,255,255,0.5)'
      default: return '#a78bfa'
    }
  }

  return (
    <button
      id="nyaya-tts-button"
      onClick={handleClick}
      disabled={status === 'loading' || !text}
      title={status === 'playing' ? 'Stop audio' : 'Listen to this content'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        background: getBgColor(),
        border: `1px solid ${getBorderColor()}`,
        borderRadius: '20px',
        padding: '7px 16px',
        color: getTextColor(),
        cursor: status === 'loading' ? 'wait' : (text ? 'pointer' : 'not-allowed'),
        fontSize: '13px',
        fontWeight: '500',
        fontFamily: 'inherit',
        transition: 'all 0.25s ease',
        opacity: !text ? 0.4 : 1,
        backdropFilter: 'blur(8px)',
        boxShadow: status === 'playing'
          ? '0 0 12px rgba(239,68,68,0.2)'
          : status === 'idle' && text
            ? '0 0 8px rgba(102,126,234,0.1)'
            : 'none',
        animation: status === 'playing' ? 'tts-pulse 1.5s ease-in-out infinite' : 'none',
      }}
    >
      <style>{`
        @keyframes tts-pulse {
          0%, 100% { box-shadow: 0 0 8px rgba(239,68,68,0.2); }
          50% { box-shadow: 0 0 16px rgba(239,68,68,0.45); }
        }
        @keyframes tts-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
      <span style={{
        fontSize: '14px',
        display: 'inline-block',
        animation: status === 'loading' ? 'tts-spin 1s linear infinite' : 'none'
      }}>
        {getIcon()}
      </span>
      <span>{getLabel()}</span>
    </button>
  )
}
