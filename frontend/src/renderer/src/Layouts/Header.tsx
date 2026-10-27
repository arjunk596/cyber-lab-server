import { useEffect, useRef, useState } from 'react'
import { Bug, EllipsisVertical, Info, Minus, Moon, Plus, RefreshCw, Sun, X } from 'lucide-react'
import Logo from '../Assets/Logo.png'
import { useTheme } from '../Utils/theme'
import '../Sass/Layouts/Header.scss'

interface Proptype {
  menuVisiblity: boolean
}

const ISSUES_URL = 'https://github.com/crce-cyberlab/cyber-lab/issues'

const Header = ({ menuVisiblity }: Proptype) => {
  const { minimize, maximize, close } = window.api.winCtrl
  const { theme, toggleTheme } = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!menuOpen) return

    const onPointerDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }

    window.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])

  return (
    <>
      <header>
        <div className="branding">
          <div className="logo"><img src={Logo} alt="CRCE Cyber Lab Logo" /></div>
          <span className="title">CRCE Cyber Lab</span>
          <span className="platform-tag">Virtual Labs</span>
        </div>

        <div className="right">
          {/* Theme Toggle Button */}
          <button
            type="button"
            className="theme-toggle-btn"
            title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
            aria-label="Toggle theme"
            onClick={toggleTheme}
          >
            {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
          </button>

          {menuVisiblity && (
            <div className="menu-wrap" ref={menuRef}>
              <button
                type="button"
                className="menu-btn"
                title="More options"
                aria-label="More options"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((open) => !open)}
              >
                <EllipsisVertical size={14} />
              </button>

              {menuOpen && (
                <ul className="menu" role="menu">
                  <li role="none">
                    <button
                      type="button"
                      role="menuitem"
                      className="menu-item"
                      onClick={() => {
                        setMenuOpen(false)
                        window.location.reload()
                      }}
                    >
                      <RefreshCw size={13} />
                      Refresh View
                    </button>
                  </li>
                  <li role="none">
                    <button
                      type="button"
                      role="menuitem"
                      className="menu-item"
                      onClick={() => {
                        setMenuOpen(false)
                        setAboutOpen(true)
                      }}
                    >
                      <Info size={13} />
                      About Platform
                    </button>
                  </li>
                  <li role="none" className="menu-divider" />
                  <li role="none">
                    <button
                      type="button"
                      role="menuitem"
                      className="menu-item"
                      onClick={() => {
                        setMenuOpen(false)
                        window.api.openURL(ISSUES_URL)
                      }}
                    >
                      <Bug size={13} />
                      Report an Issue
                    </button>
                  </li>
                </ul>
              )}
            </div>
          )}

          <div className="window-ctrl">
            <button
              type="button"
              className="win-ctrl-btn minimize"
              title="Minimize"
              aria-label="Minimize"
              onClick={() => minimize()}
            >
              <Minus size={11} />
            </button>

            <button
              type="button"
              className="win-ctrl-btn maximize"
              title="Maximize"
              aria-label="Maximize"
              onClick={() => maximize()}
            >
              <Plus size={11} />
            </button>

            <button
              type="button"
              className="win-ctrl-btn close"
              title="Close"
              aria-label="Close"
              onClick={() => close()}
            >
              <X size={11} />
            </button>
          </div>
        </div>
      </header>

      {aboutOpen && menuVisiblity && (
        <div className="about-overlay" onClick={() => setAboutOpen(false)}>
          <div
            className="about-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="About CRCE Cyber Lab"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="about-close"
              aria-label="Close"
              onClick={() => setAboutOpen(false)}
            >
              <X size={14} />
            </button>
            <img className="about-logo" src={Logo} alt="CRCE Cyber Lab" />
            <h2>CRCE Cyber Lab</h2>
            <p>
              A hands-on cybersecurity education and experiment platform engineered for
              hands-on network analysis, cryptographic simulation, and vulnerability defense.
            </p>
            <span className="about-meta">v1.2.0 • Electron • React 19 • Python</span>
          </div>
        </div>
      )}
    </>
  )
}

export default Header
