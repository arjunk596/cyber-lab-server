import React, { useState } from 'react'
import { CheckCircle2, ShieldCheck } from 'lucide-react'
import type { Experiment } from '@shared/experiment'
import { getDefensesForLab, type DefenseItem, type MetricComparison } from '@renderer/Constant/labDefences'
import '../Sass/Components/LabDefencesView.scss'

interface LabDefencesViewProps {
  experiment: Experiment
}

export const LabDefencesView: React.FC<LabDefencesViewProps> = ({ experiment }) => {
  const defenseData = getDefensesForLab(experiment.github_repo_name)

  const [activeStates, setActiveStates] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {}
    defenseData.defenses.forEach((d) => {
      init[d.id] = d.defaultActive
    })
    return init
  })

  const handleToggle = (id: string) => {
    setActiveStates((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const activeCount = Object.values(activeStates).filter(Boolean).length

  return (
    <div className="lab-defences-view">
      <div className="defences-hero">
        <div>
          <h2>{defenseData.heroTitle}</h2>
          <p>{defenseData.heroDescription}</p>
        </div>
        <div className="defences-summary-badge">
          <ShieldCheck size={16} />
          <span>{activeCount} of {defenseData.defenses.length} Defenses Active</span>
        </div>
      </div>

      <div className="defences-grid">
        {/* Left Column: Specific Defense Toggle Cards */}
        <div className="defences-cards-col">
          {defenseData.defenses.map((d: DefenseItem, idx: number) => {
            const isActive = !!activeStates[d.id]
            return (
              <div key={d.id} className={`defense-card ${isActive ? 'card-active' : ''}`}>
                <div className="card-top">
                  <div className="card-title-group">
                    <span className="card-num">{String(idx + 1).padStart(2, '0')}</span>
                    <div>
                      <h4>{d.title}</h4>
                      <span className="card-sub">{d.subtitle}</span>
                    </div>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={() => handleToggle(d.id)}
                    />
                    <span className="slider round" />
                  </label>
                </div>
                <p className="card-desc">{d.description}</p>
                {d.command && (
                  <div className="card-cmd">
                    <code>{d.command}</code>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Right Column: Lab-Specific Telemetry Comparison */}
        <div className="defences-metrics-col">
          <div className="panel metrics-panel">
            <div className="panel-header">
              <h3>Before vs After Mitigation Impact</h3>
            </div>

            <div className="metrics-table-wrap">
              <table className="metrics-table">
                <thead>
                  <tr>
                    <th>Security Metric</th>
                    <th>Unmitigated Attack</th>
                    <th>Mitigated (Active)</th>
                    <th>Improvement</th>
                  </tr>
                </thead>
                <tbody>
                  {defenseData.metrics.map((m: MetricComparison, idx: number) => (
                    <tr key={idx}>
                      <td>{m.name}</td>
                      <td className="val-bad">{m.unmitigated}</td>
                      <td className="val-good">{activeCount > 0 ? m.mitigated : m.unmitigated}</td>
                      <td className="val-diff">{activeCount > 0 ? m.improvement : 'No Defense'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mitigation-status-box">
              <div className="status-header">
                <CheckCircle2 size={18} className="check-icon" />
                <h4>{defenseData.summaryTitle}</h4>
              </div>
              <p>{defenseData.summaryDescription}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LabDefencesView
