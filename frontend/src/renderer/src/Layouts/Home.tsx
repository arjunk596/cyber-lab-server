import { useEffect, useMemo, useState, Dispatch, SetStateAction } from 'react'
import { useNavigate } from 'react-router'
import { ChevronDown, Search, SearchX } from 'lucide-react'
import { CATEGORIES, DIFFICULTIES, type Experiment } from '@shared/experiment'
import ExperimentCard from '@renderer/Components/ExperimentCard'
import CardSkeleton from '@renderer/Components/CardSkeleton'
import '../Sass/Layouts/Home.scss'

interface Proptype {
  setMenuVisiblity: Dispatch<SetStateAction<boolean>>
}

const SKELETON_COUNT = 10
const API_URL = (import.meta.env.RENDERER_VITE_API_URL as string)

const Home = ({ setMenuVisiblity }: Proptype) => {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('All')
  const [difficulty, setDifficulty] = useState<(typeof DIFFICULTIES)[number]>('All Difficulties')
  const [experiments, setExperiments] = useState<Experiment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setMenuVisiblity(true)
    let cancelled = false

    const load = async (): Promise<void> => {
      try {
        const res = await fetch(API_URL, {
          headers: { 'ngrok-skip-browser-warning': 'true' }
        })
        const json = await res.json()
        const list: Experiment[] = (
          Array.isArray(json) ?
            json
            :
            Array.isArray(json?.data) ?
              json.data
              :
              []
        )
        if (!cancelled) setExperiments(list)
      } catch {
        if (!cancelled) setExperiments([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return experiments.filter((exp) => {
      const matchQuery =
        !q ||
        exp.title.toLowerCase().includes(q) ||
        exp.description.toLowerCase().includes(q)
      const matchCategory = category === 'All' || exp.category === category
      const matchDifficulty = difficulty === 'All Difficulties' || exp.difficulty === difficulty
      return matchQuery && matchCategory && matchDifficulty
    })
  }, [experiments, query, category, difficulty])

  const handleStart = (exp: Experiment) => {
    sessionStorage.setItem('lab-experiment', JSON.stringify(exp))
    navigate('/lab')
  }

  return (
    <div className="home">
      <section className="home-hero">
        <h1 className="home-title">Cybersecurity Experiments</h1>
        <p className="home-subtitle">Select an experiment to begin your hands-on lab.</p>
      </section>

      <section className="home-toolbar">
        <div className="home-toolbar-row">
          <label className="home-search">
            <Search size={16} className="home-search-icon" />
            <input
              type="text"
              placeholder="Search experiments..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>

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
            <ChevronDown size={15} className="home-select-icon" />
          </label>
        </div>

        <div className="home-tabs">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              className={`home-tab ${category === c ? 'active' : ''}`}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
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
          {filtered.map((exp) => {
            return <ExperimentCard key={exp.id} experiment={exp} onStart={handleStart} />
          })}
        </section>
      ) : (
        <section className="home-empty">
          <SearchX size={28} />
          <h3>No experiments found</h3>
          <p>Try a different search term or filter.</p>
        </section>
      )}
    </div>
  )
}

export default Home
