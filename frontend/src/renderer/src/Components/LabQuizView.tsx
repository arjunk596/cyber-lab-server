import React, { useState } from 'react'
import { CheckCircle2, XCircle, RotateCcw, Award, AlertCircle, HelpCircle } from 'lucide-react'
import type { Experiment } from '@shared/experiment'
import { getQuizForLab, type QuizQuestion } from '@renderer/Constant/labQuizzes'
import '../Sass/Components/LabQuizView.scss'

interface LabQuizViewProps {
  experiment?: Experiment
  repoName?: string
  labTitle?: string
  onPass?: (score: number) => void
  onQuizPassed?: () => void
}

export const LabQuizView: React.FC<LabQuizViewProps> = ({
  experiment,
  repoName,
  labTitle,
  onPass,
  onQuizPassed
}) => {
  const targetRepo = repoName || experiment?.github_repo_name || 'css_mini'
  const title = labTitle || experiment?.title || 'Cybersecurity Lab'
  const quizData = getQuizForLab(targetRepo)

  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({})
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  const handleSelectOption = (questionId: number, optionIdx: number) => {
    if (isSubmitted) return
    setSelectedAnswers((prev) => ({ ...prev, [questionId]: optionIdx }))
    setValidationError(null)
  }

  const handleSubmit = () => {
    const unanswered = quizData.questions.filter((q) => selectedAnswers[q.id] === undefined)
    if (unanswered.length > 0) {
      setValidationError(
        `Please answer all ${quizData.questions.length} questions before submitting (Question ${unanswered[0].id} is unanswered).`
      )
      return
    }

    setIsSubmitted(true)
    setValidationError(null)

    const correctCount = quizData.questions.filter(
      (q) => selectedAnswers[q.id] === q.correctIndex
    ).length
    const scorePct = Math.round((correctCount / quizData.questions.length) * 100)

    if (scorePct >= 60) {
      onPass?.(scorePct)
      onQuizPassed?.()
    }
  }

  const handleRetry = () => {
    setSelectedAnswers({})
    setIsSubmitted(false)
    setValidationError(null)
  }

  const correctCount = quizData.questions.filter(
    (q) => selectedAnswers[q.id] === q.correctIndex
  ).length
  const totalCount = quizData.questions.length
  const scorePct = Math.round((correctCount / totalCount) * 100)
  const passed = scorePct >= 60

  return (
    <div className="lab-quiz-view">
      {/* Quiz Hero Banner */}
      <div className="quiz-hero">
        <div className="quiz-hero-info">
          <div className="quiz-progress-badge">
            <HelpCircle size={14} />
            <span>Educational Knowledge Assessment</span>
          </div>
          <h2>Knowledge Verification Quiz</h2>
          <p>
            Assess your understanding of the concepts, telemetry, protocols, and defensive
            measures explored in <strong>{title}</strong>.
          </p>
        </div>

        {isSubmitted && (
          <div className={`quiz-score-badge ${passed ? 'passed' : 'failed'}`}>
            <Award size={20} />
            <div className="score-details">
              <span className="score-num">
                {correctCount} / {totalCount} ({scorePct}%)
              </span>
              <span className="score-status">{passed ? 'Passed & Verified' : 'Needs Review'}</span>
            </div>
          </div>
        )}
      </div>

      {validationError && (
        <div className="quiz-alert-box">
          <AlertCircle size={16} />
          <span>{validationError}</span>
        </div>
      )}

      {/* Questions List */}
      <div className="quiz-questions-list">
        {quizData.questions.map((q: QuizQuestion, index: number) => {
          const userAnswer = selectedAnswers[q.id]
          const isCorrect = isSubmitted && userAnswer === q.correctIndex

          return (
            <div
              key={q.id}
              className={`question-card ${
                isSubmitted ? (isCorrect ? 'card-correct' : 'card-incorrect') : ''
              }`}
            >
              <div className="question-header">
                <span className="question-idx">
                  Q{index + 1} of {totalCount}
                </span>
                <h3 className="question-text">{q.question}</h3>
                {isSubmitted && (
                  <span className={`status-icon ${isCorrect ? 'correct' : 'wrong'}`}>
                    {isCorrect ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                  </span>
                )}
              </div>

              <div className="options-list">
                {q.options.map((optText: string, optIdx: number) => {
                  const isSelected = userAnswer === optIdx
                  const isCorrectChoice = isSubmitted && optIdx === q.correctIndex
                  const isWrongSelected = isSubmitted && isSelected && optIdx !== q.correctIndex

                  return (
                    <button
                      key={optIdx}
                      type="button"
                      disabled={isSubmitted}
                      className={`quiz-option ${isSelected ? 'opt-selected' : ''} ${
                        isCorrectChoice ? 'opt-correct' : ''
                      } ${isWrongSelected ? 'opt-wrong' : ''}`}
                      onClick={() => handleSelectOption(q.id, optIdx)}
                    >
                      <span className="opt-label">{String.fromCharCode(65 + optIdx)}</span>
                      <span className="opt-text">{optText}</span>
                    </button>
                  )
                })}
              </div>

              {isSubmitted && (
                <div className="question-explanation">
                  <strong>Explanation:</strong> {q.explanation}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Bottom Action Toolbar */}
      <div className="quiz-actions-footer">
        {!isSubmitted ? (
          <button type="button" className="submit-quiz-btn" onClick={handleSubmit}>
            Submit Answers & Check Score
          </button>
        ) : (
          <div className="submitted-actions">
            <button type="button" className="retry-quiz-btn" onClick={handleRetry}>
              <RotateCcw size={14} />
              Re-attempt Quiz
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default LabQuizView
