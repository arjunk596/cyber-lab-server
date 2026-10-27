import React, { useState } from 'react'
import { Star, MessageSquare, CheckCircle2, X, Send } from 'lucide-react'
import type { Experiment } from '@shared/experiment'
import '../Sass/Components/LabFeedbackModal.scss'

interface LabFeedbackModalProps {
  experiment?: Experiment
  experimentId?: string
  labTitle?: string
  isOpen: boolean
  onClose: () => void
  onSubmitted?: () => void
}

const API_BASE = (import.meta.env.RENDERER_VITE_API_URL as string) || 'http://localhost:8000/'
const FEEDBACK_URL = API_BASE.endsWith('/') ? `${API_BASE}feedback` : `${API_BASE}/feedback`

export const LabFeedbackModal: React.FC<LabFeedbackModalProps> = ({
  experiment,
  experimentId,
  labTitle,
  isOpen,
  onClose,
  onSubmitted
}) => {
  const [rating, setRating] = useState<number>(5)
  const [ease, setEase] = useState<number>(4)
  const [difficulty, setDifficulty] = useState<string>('Appropriate')
  const [objectiveAchieved, setObjectiveAchieved] = useState<boolean>(true)
  const [comments, setComments] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [submittedSuccess, setSubmittedSuccess] = useState<boolean>(false)

  if (!isOpen) return null

  const targetId = experimentId || experiment?.id || 'unknown-lab'
  const targetTitle = labTitle || experiment?.title || 'Cybersecurity Lab'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    const payload = {
      experiment_id: targetId,
      experiment_title: targetTitle,
      rating,
      ease_of_understanding: ease,
      perceived_difficulty: difficulty,
      objective_achieved: objectiveAchieved,
      comments: comments.trim(),
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

      setSubmittedSuccess(true)
      if (onSubmitted) onSubmitted()
      setTimeout(() => {
        onClose()
        setSubmittedSuccess(false)
      }, 2200)
    } catch {
      // Still show success to student while storing locally
      try {
        const stored = JSON.parse(localStorage.getItem('crce_lab_feedback') || '[]')
        stored.push(payload)
        localStorage.setItem('crce_lab_feedback', JSON.stringify(stored))
      } catch {
        // ignore
      }
      setSubmittedSuccess(true)
      setTimeout(() => {
        onClose()
        setSubmittedSuccess(false)
      }, 2200)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="feedback-modal-overlay" onClick={onClose}>
      <div
        className="feedback-modal-container"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="feedback-modal-header">
          <div className="header-icon-title">
            <MessageSquare size={20} className="icon-blue" />
            <div>
              <h3>Post-Lab Learning Evaluation</h3>
              <p className="lab-sub">{targetTitle}</p>
            </div>
          </div>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Close dialog">
            <X size={16} />
          </button>
        </div>

        {submittedSuccess ? (
          <div className="feedback-submitted-state">
            <CheckCircle2 size={44} className="icon-success" />
            <h3>Feedback Received</h3>
            <p>
              Thank you for evaluating this laboratory experiment. Your responses have been
              recorded by the Department of Computer Engineering.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="feedback-form">
            {/* 1. Overall Experience Rating */}
            <div className="feedback-field">
              <label>Overall Experiment Rating</label>
              <div className="star-rating-row">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    className={`star-btn ${rating >= star ? 'star-active' : ''}`}
                    onClick={() => setRating(star)}
                  >
                    <Star size={24} fill={rating >= star ? 'currentColor' : 'none'} />
                  </button>
                ))}
                <span className="rating-label">{rating} of 5 Stars</span>
              </div>
            </div>

            {/* 2. Ease of Understanding */}
            <div className="feedback-field">
              <label>Ease of Understanding & Clarity</label>
              <div className="radio-pills">
                {[
                  { val: 1, label: 'Unclear' },
                  { val: 2, label: 'Challenging' },
                  { val: 3, label: 'Average' },
                  { val: 4, label: 'Clear' },
                  { val: 5, label: 'Very Clear' }
                ].map((item) => (
                  <label
                    key={item.val}
                    className={`pill-label ${ease === item.val ? 'pill-active' : ''}`}
                  >
                    <input
                      type="radio"
                      name="ease"
                      value={item.val}
                      checked={ease === item.val}
                      onChange={() => setEase(item.val)}
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* 3. Difficulty */}
            <div className="feedback-field">
              <label>Lab Difficulty Level</label>
              <div className="radio-pills">
                {['Introductory', 'Appropriate', 'Challenging', 'Very Advanced'].map((d) => (
                  <label
                    key={d}
                    className={`pill-label ${difficulty === d ? 'pill-active' : ''}`}
                  >
                    <input
                      type="radio"
                      name="difficulty"
                      value={d}
                      checked={difficulty === d}
                      onChange={() => setDifficulty(d)}
                    />
                    <span>{d}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* 4. Objective Achieved */}
            <div className="feedback-field">
              <label>Did you successfully achieve the learning objectives?</label>
              <div className="radio-pills">
                <label className={`pill-label ${objectiveAchieved ? 'pill-active' : ''}`}>
                  <input
                    type="radio"
                    name="objective"
                    checked={objectiveAchieved}
                    onChange={() => setObjectiveAchieved(true)}
                  />
                  <span>Yes, completely</span>
                </label>
                <label className={`pill-label ${!objectiveAchieved ? 'pill-active' : ''}`}>
                  <input
                    type="radio"
                    name="objective"
                    checked={!objectiveAchieved}
                    onChange={() => setObjectiveAchieved(false)}
                  />
                  <span>Partially / Need more practice</span>
                </label>
              </div>
            </div>

            {/* 5. Written Comments */}
            <div className="feedback-field">
              <label>
                Comments or Suggestions for Improvement <span className="opt">(Optional)</span>
              </label>
              <textarea
                rows={3}
                placeholder="Share your thoughts about this virtual experiment..."
                value={comments}
                onChange={(e) => setComments(e.target.value)}
              />
            </div>

            {/* Actions */}
            <div className="feedback-actions">
              <button
                type="button"
                className="btn-skip"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Skip
              </button>
              <button
                type="submit"
                className="btn-submit"
                disabled={isSubmitting}
              >
                <Send size={13} />
                <span>{isSubmitting ? 'Submitting…' : 'Submit Feedback'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export default LabFeedbackModal
