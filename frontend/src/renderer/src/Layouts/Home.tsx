import { useEffect, useMemo, useState, Dispatch, SetStateAction } from 'react'
import { useNavigate } from 'react-router'
import { ChevronDown, RefreshCw, Search, SearchX, X, WifiOff } from 'lucide-react'
import { CATEGORIES, DIFFICULTIES, type Experiment } from '@shared/experiment'
import ExperimentCard from '@renderer/Components/ExperimentCard'
import CardSkeleton from '@renderer/Components/CardSkeleton'
import { DEFAULT_EXPERIMENTS } from '@renderer/Constant/defaultLabs'
import '../Sass/Layouts/Home.scss'

interface Proptype {
  setMenuVisiblity: Dispatch<SetStateAction<boolean>>
}

const SKELETON_COUNT = 6
const API_URL = (import.meta.env.RENDERER_VITE_API_URL as string) || 'http://localhost:8000/'

const Home = ({ setMenuVisiblity }: Proptype) => {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('All')
  const [difficulty, setDifficulty] = useState<(typeof DIFFICULTIES)[number]>('All Difficulties')
  const [experiments, setExperiments] = useState<Experiment[]>(DEFAULT_EXPERIMENTS)
  const [loading, setLoading] = useState(true)
  const [isOfflineFallback, setIsOfflineFallback] = useState(false)

  const loadExperiments = async (cancelled = false) => {
    setLoading(true)
    try {
      const res = await fetch(API_URL, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      const list: Experiment[] = Array.isArray(json)
        ? json
        : Array.isArray(json?.data)
          ? json.data
          : []
      if (!cancelled) {
        setExperiments(list.length > 0 ? list : DEFAULT_EXPERIMENTS)
        setIsOfflineFallback(false)
      }
    } catch {
      if (!cancelled) {
        setExperiments(DEFAULT_EXPERIMENTS)
        setIsOfflineFallback(true)
      }
    } finally {
      if (!cancelled) setLoading(false)
    }
  }

  useEffect(() => {
    setMenuVisiblity(true)
    let cancelled = false
    loadExperiments(cancelled)
    return () => {
      cancelled = true
    }
  }, [setMenuVisiblity])

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: experiments.length }
    for (const exp of experiments) {
      counts[exp.category] = (counts[exp.category] || 0) + 1
    }
    return counts
  }, [experiments])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return experiments.filter((exp) => {
      const matchQuery =
        !q ||
        exp.title.toLowerCase().includes(q) ||
        exp.description.toLowerCase().includes(q) ||
        (exp.github_repo_name && exp.github_repo_name.toLowerCase().includes(q))
      const matchCategory = category === 'All' || exp.category === category
      const matchDifficulty = difficulty === 'All Difficulties' || exp.difficulty === difficulty
      return matchQuery && matchCategory && matchDifficulty
    })
  }, [experiments, query, category, difficulty])

  const handleStart = (exp: Experiment) => {
    sessionStorage.setItem('lab-experiment', JSON.stringify(exp))
    navigate('/lab')
  }

  const handleClearSearch = () => {
    setQuery('')
  }

  const handleResetFilters = () => {
    setQuery('')
    setCategory('All')
    setDifficulty('All Difficulties')
  }

  return (
    <div className="home">
      <section className="home-hero">
        <div className="home-hero-content">
          <div>
            <h1 className="home-title">Cybersecurity Experiments</h1>
            <p className="home-subtitle">Select an experiment to begin your hands-on virtual lab session.</p>
          </div>
          <div className="home-stats-pill">
            <span className="stats-dot" />
            <span>Showing {filtered.length} of {experiments.length} labs</span>
          </div>
        </div>

        {isOfflineFallback && (
          <div className="offline-banner">
            <div className="offline-msg">
              <WifiOff size={14} />
              <span>Catalog API is starting up — running in offline cached mode.</span>
            </div>
            <button
              type="button"
              className="offline-retry-btn"
              onClick={() => loadExperiments(false)}
            >
              <RefreshCw size={12} />
              Retry Connection
            </button>
          </div>
        )}
      </section>

      <section className="home-toolbar">
        <div className="home-toolbar-row">
          <div className="home-search">
            <Search size={15} className="home-search-icon" />
            <input
              type="text"
              placeholder="Search experiments by title, category, or keyword..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={handleClearSearch}
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <label className="home-select">
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as typeof difficulty)}
            >
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="home-select-icon" />
          </label>
        </div>

        <div className="home-tabs">
          {CATEGORIES.map((c) => {
            const count = categoryCounts[c] ?? 0
            return (
              <button
                key={c}
                type="button"
                className={`home-tab ${category === c ? 'active' : ''}`}
                onClick={() => setCategory(c)}
              >
                <span>{c}</span>
                <span className="tab-count">{count}</span>
              </button>
            )
          })}
        </div>
      </section>

      {loading ? (
        <section className="home-grid">
          {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </section>
      ) : filtered.length > 0 ? (
        <section className="home-grid">
          {filtered.map((exp) => (
            <ExperimentCard key={exp.id} experiment={exp} onStart={handleStart} />
          ))}
        </section>
      ) : (
        <section className="home-empty">
          <SearchX size={32} />
          <h3>No matching experiments found</h3>
          <p>No experiments matched your current filter criteria.</p>
          <button type="button" className="reset-filters-btn" onClick={handleResetFilters}>
            Reset Filters
          </button>
        </section>
      )}
    </div>
  )
}

export default Home
