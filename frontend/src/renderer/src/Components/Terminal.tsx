import { useEffect, useRef, useState, useCallback, type JSX } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { TerminalSquare, RotateCcw } from 'lucide-react'
import '@xterm/xterm/css/xterm.css'
import '../Sass/Components/Terminal.scss'

const termTheme = {
  background: '#0d1526',
  foreground: '#dbe4f3',
  cursor: '#3b82f6',
  cursorAccent: '#0d1526',
  selectionBackground: 'rgba(59, 130, 246, 0.35)',
  selectionForeground: '#e8eef9',
  black: '#1c2949',
  red: '#f87171',
  green: '#4ade80',
  yellow: '#facc15',
  blue: '#60a5fa',
  magenta: '#c084fc',
  cyan: '#22d3ee',
  white: '#dbe4f3',
  brightBlack: '#8b9bb8',
  brightWhite: '#f5f8ff'
}

const STATUS_TEXT: Record<'on' | 'off' | 'dead', string> = {
  on: 'connected',
  off: 'starting…',
  dead: 'session ended'
}

interface Proptype {
  cwd?: string
}

const Terminal = ({ cwd }: Proptype): JSX.Element => {
  const bodyRef = useRef<HTMLDivElement | null>(null)
  const termRef = useRef<XTerm | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const [status, setStatus] = useState<'on' | 'off' | 'dead'>('off')
  const [ready, setReady] = useState<boolean>(false)

  const fit = useCallback(() => {
    const term = termRef.current
    const fitAddon = fitRef.current
    if (!term || !fitAddon) return
    try {
      fitAddon.fit()
    } catch {
      return
    }
    if (term.cols > 0 && term.rows > 0) window.api.pty.resize(term.cols, term.rows)
  }, [])

  const boot = useCallback(async () => {
    const term = termRef.current
    const fitAddon = fitRef.current
    if (!term || !fitAddon) return
    term.reset()
    setStatus('off')
    try {
      fitAddon.fit()
    } catch { }
    const ok = await window.api.pty.spawn(term.cols, term.rows, cwd)
    if (!ok) setStatus('dead')
    else {
      setStatus('on')
      fit()
    }
  }, [cwd, fit])

  useEffect(() => {
    const host = bodyRef.current
    if (!host) return

    const term = new XTerm({
      fontFamily: "'JetBrains Mono','Fira Code','Cascadia Code',Menlo,Consolas,monospace",
      fontSize: 12.5,
      lineHeight: 1.15,
      cursorBlink: true,
      cursorStyle: 'bar',
      scrollback: 4000,
      convertEol: false,
      theme: termTheme
    })
    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(host)
    termRef.current = term
    fitRef.current = fitAddon
    fit()
    term.focus()

    const onDataSub = window.api.pty.onData((data) => term.write(data))
    const onExitSub = window.api.pty.onExit(() => {
      setStatus('dead')
      term.write('\r\n\x1b[90m[session ended — press ⟳ to restart]\x1b[0m\r\n')
    })

    const inputSub = term.onData((data) => window.api.pty.write(data))

    const observer = new ResizeObserver(() => fit())
    observer.observe(host)

    setReady(true)

    return () => {
      observer.disconnect()
      onDataSub()
      onExitSub()
      inputSub.dispose()
      window.api.pty.kill()
      term.dispose()
      termRef.current = null
      fitRef.current = null
      setReady(false)
    }
  }, [fit])

  useEffect(() => {
    if (!ready) return
    void boot()
  }, [ready, boot])

  const folder = cwd ? cwd.split(/[\\/]/).filter(Boolean).pop() : null

  return (
    <div className="terminal-ctn">
      <div className="terminal-head">
        <span className="t-label" title={cwd}>
          <TerminalSquare size={14} />
          bash · {folder ?? 'lab shell'}
          <span className={`t-status ${status}`} />
          {STATUS_TEXT[status]}
        </span>
        <button
          type="button"
          className="t-restart"
          title="Restart shell"
          onClick={() => { void boot() }}
        >
          <RotateCcw size={14} />
        </button>
      </div>
      <div className="terminal-body" ref={bodyRef} />
    </div>
  )
}

export default Terminal
