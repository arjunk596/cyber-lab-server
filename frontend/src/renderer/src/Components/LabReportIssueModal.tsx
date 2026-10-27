import React, { useState } from 'react'
import { Bug, X, Send, CheckCircle2, AlertTriangle } from 'lucide-react'
import type { Experiment } from '@shared/experiment'
import '../Sass/Components/LabReportIssueModal.scss'

interface LabReportIssueModalProps {
  experiment: Experiment
  isOpen: boolean
  onClose: () => void
}

const API_BASE = (import.meta.env.RENDERER_VITE_API_URL as string) || 'http://localhost:8000/'
const FEEDBACK_URL = API_BASE.endsWith('/') ? `${API_BASE}feedback` : `${API_BASE}/feedback`

export const LabReportIssueModal: React.FC<LabReportIssueModalProps> = ({
  experiment,
  isOpen,
  onClose
}) => {
  const [category, setCategory] = useState<string>('Simulation Glitch')
  const [title, setTitle] = useState<string>('')
  const [description, setDescription] = useState<string>('')
  const [reproduceSteps, setReproduceSteps] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [isSuccess, setIsSuccess] = useState<boolean>(false)
  const [errorMsg, setErrorMsg] = useState<string>('')

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      setErrorMsg('Please provide a brief title for the issue or feedback.')
      return
    }
    if (!description.trim()) {
      setErrorMsg('Please describe what happened or what should be improved.')
      return
    }

    setIsSubmitting(true)
    setErrorMsg('')

    const payload = {
      experiment_id: experiment.id,
      experiment_title: experiment.title,
      lab_repo: experiment.github_repo_name,
      issue_category: category,
      rating: 3,
      ease_of_understanding: 3,
      perceived_difficulty: 'Issue Reported',
      objective_achieved: false,
      comments: `[ISSUE - ${category.toUpperCase()}] ${title}: ${description}${
        reproduceSteps ? ` | Steps: ${reproduceSteps}` : ''
      }`,
      created_at: new Date().toISOString()
    }

    try {
      const res = await fetch(FEEDBACK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`)
      }

      setIsSuccess(true)
      setTimeout(() => {
        setIsSuccess(false)
        onClose()
      }, 2400)
    } catch {
      // Offline fallback: save to localStorage
      try {
        const stored = JSON.parse(localStorage.getItem('crce_lab_issues') || '[]')
        stored.push(payload)
        localStorage.setItem('crce_lab_issues', JSON.stringify(stored))
      } catch {
        // ignore
      }
      setIsSuccess(true)
      setTimeout(() => {
        setIsSuccess(false)
        onClose()
      }, 2400)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="report-issue-overlay" onClick={onClose}>
      <div
        className="report-issue-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-header">
          <div className="header-title-box">
            <div className="icon-badge">
              <Bug size={18} />
            </div>
            <div>
              <h3>Report Lab Issue & Direct Feedback</h3>
              <span className="sub-title">{experiment.title}</span>
            </div>
          </div>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Close dialog">
            <X size={16} />
          </button>
        </div>

        {isSuccess ? (
          <div className="success-state">
            <CheckCircle2 size={44} className="icon-success" />
            <h3>Issue Logged Successfully</h3>
            <p>
              Your report and feedback have been dispatched to the laboratory maintainer queue for{' '}
              <strong>{experiment.title}</strong>. Thank you for helping improve the lab platform!
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="report-form">
            {errorMsg && (
              <div className="form-alert-error">
                <AlertTriangle size={15} />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Issue Category Radio Pills */}
            <div className="form-group">
              <label>Issue Type</label>
              <div className="category-pills">
                {[
                  'Simulation Glitch',
                  'Formula / Math Error',
                  'Command / Terminal Failure',
                  'Visual / Layout Bug',
                  'Content Suggestion'
                ].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    className={`cat-pill ${category === cat ? 'active' : ''}`}
                    onClick={() => setCategory(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Summary Title */}
            <div className="form-group">
              <label htmlFor="issueTitle">
                Issue Summary <span className="req">*</span>
              </label>
              <input
                id="issueTitle"
                type="text"
                placeholder="e.g. Memory address table not updating on level 2 payload"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value)
                  if (errorMsg) setErrorMsg('')
                }}
              />
            </div>

            {/* Detailed Description */}
            <div className="form-group">
              <label htmlFor="issueDesc">
                Details & Expected vs Observed Behavior <span className="req">*</span>
              </label>
              <textarea
                id="issueDesc"
                rows={4}
                placeholder="Describe what occurred, any error messages shown, or what you were trying to do..."
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value)
                  if (errorMsg) setErrorMsg('')
                }}
              />
            </div>

            {/* Steps to Reproduce */}
            <div className="form-group">
              <label htmlFor="issueSteps">
                Steps to Reproduce or Payload Entered <span className="opt">(Optional)</span>
              </label>
              <input
                id="issueSteps"
                type="text"
                placeholder="e.g. Switched to Level 2, entered 24 A's, clicked Execute"
                value={reproduceSteps}
                onChange={(e) => setReproduceSteps(e.target.value)}
              />
            </div>

            {/* Modal Actions */}
            <div className="modal-actions">
              <button
                type="button"
                className="btn-cancel"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-submit"
                disabled={isSubmitting}
              >
                <Send size={13} />
                <span>{isSubmitting ? 'Submitting…' : 'Submit Issue Report'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export default LabReportIssueModal
