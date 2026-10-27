import React, { useState } from 'react'
import { Award, CheckCircle2, Printer, Edit3, Sparkles, FileText, ArrowRight } from 'lucide-react'
import type { Experiment } from '@shared/experiment'
import Logo from '../Assets/Logo.png'
import '../Sass/Components/LabReviewView.scss'

interface LabReviewViewProps {
  experiment: Experiment
  isQuizCompleted?: boolean
  quizScore?: number
  onOpenFeedback?: () => void
}

export const LabReviewView: React.FC<LabReviewViewProps> = ({
  experiment,
  isQuizCompleted = false,
  quizScore = 0,
  onOpenFeedback
}) => {
  const [studentName, setStudentName] = useState<string>('')
  const [studentId, setStudentId] = useState<string>('')
  const [isGenerated, setIsGenerated] = useState<boolean>(false)
  const [nameError, setNameError] = useState<string>('')

  const completionDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!studentName.trim() || studentName.trim().length < 2) {
      setNameError('Please enter a valid student full name before generating the certificate.')
      return
    }
    setNameError('')
    setIsGenerated(true)
  }

  const handlePrint = () => {
    window.print()
  }

  const getLabCompetencies = (repo: string) => {
    const r = repo.toLowerCase()
    if (r === 'css_mini') {
      return [
        {
          title: 'TCP Handshake State Transition',
          desc: 'Observed SYN_SENT to SYN_RECEIVED transitions and half-open socket backlog exhaustion.'
        },
        {
          title: 'Syn Flood Attack Dynamics',
          desc: 'Simulated illegitimate connection bursts and monitored connection pool saturation.'
        },
        {
          title: 'Mitigation Techniques',
          desc: 'Configured and tested SYN cookies (RFC 4987) and kernel backlog queue tuning.'
        }
      ]
    }
    if (r === 'css-lab-simulation') {
      return [
        {
          title: 'RSA Key Generation & Prime Verification',
          desc: 'Calculated totient φ(n), chosen coprimes, and modular multiplicative inverse for private exponents.'
        },
        {
          title: 'Chosen Ciphertext Attack (CCA)',
          desc: 'Demonstrated multiplicative homomorphic vulnerability using blinding factor s and decryption oracle.'
        },
        {
          title: 'Cryptographic Padding Standards',
          desc: 'Evaluated OAEP padding to prevent malleability and semantic insecurity in textbook RSA.'
        }
      ]
    }
    if (r === 'css-lab-boa') {
      return [
        {
          title: 'x86 Stack Frame Anatomy',
          desc: 'Traced local buffer allocation, saved EBP, and return address alignment on 32-bit architecture.'
        },
        {
          title: 'Control Flow Hijacking',
          desc: 'Constructed precise boundary payloads to overwrite EIP register and divert execution.'
        },
        {
          title: 'Modern Binary Protections',
          desc: 'Evaluated compiler protections including GCC Stack Canaries (-fstack-protector), ASLR, and DEP/NX.'
        }
      ]
    }
    if (r === 'packet_spoofing') {
      return [
        {
          title: 'Promiscuous Packet Dissection',
          desc: 'Captured and decoded Ethernet, IPv4, TCP, and application layer frames.'
        },
        {
          title: 'ARP Cache Poisoning & MiTM',
          desc: 'Analyzed gratuitous ARP spoofing and gateway impersonation attack mechanics.'
        },
        {
          title: 'L2/L3 Network Countermeasures',
          desc: 'Configured Dynamic ARP Inspection (DAI), static ARP binding, and TLS transport security.'
        }
      ]
    }
    if (r === 'css-virtual-lab') {
      return [
        {
          title: 'Volumetric vs Distributed DoS',
          desc: 'Contrasted single-source stress testing against multi-node distributed botnet saturation.'
        },
        {
          title: 'Network Telemetry & Saturation',
          desc: 'Monitored throughput degradation, packet loss metrics, and latency spikes.'
        },
        {
          title: 'Edge Rate Limiting & Scrubbing',
          desc: 'Implemented token bucket rate-limiting algorithms and traffic filtering.'
        }
      ]
    }
    return [
      {
        title: 'MCP Host-Sandbox Isolation',
        desc: 'Evaluated process boundary restrictions and permission escape vulnerabilities.'
      },
      {
        title: 'Heuristic Behavioral Inspection',
        desc: 'Monitored suspicious process spawning and egress network communication attempts.'
      },
      {
        title: 'Zero-Trust Defense Strategy',
        desc: 'Enforced read-only filesystem containers and principle of least privilege execution.'
      }
    ]
  }

  const competencies = getLabCompetencies(experiment.github_repo_name)

  return (
    <div className="lab-review-view">
      <div className="review-hero no-print">
        <div>
          <h2>Experiment Review & Lab Verification</h2>
          <p>
            Review verified competencies, enter your student credentials, and generate your
            official participation certificate for <strong>{experiment.title}</strong>.
          </p>
        </div>
        {isGenerated && (
          <div className="hero-actions">
            <button
              type="button"
              className="action-btn outline"
              onClick={() => setIsGenerated(false)}
            >
              <Edit3 size={14} />
              Edit Student Name
            </button>
            <button type="button" className="action-btn primary" onClick={handlePrint}>
              <Printer size={14} />
              Print / Save PDF
            </button>
            {onOpenFeedback && (
              <button type="button" className="action-btn secondary" onClick={onOpenFeedback}>
                <Sparkles size={14} />
                Submit Lab Feedback
              </button>
            )}
          </div>
        )}
      </div>

      <div className="review-grid">
        {/* Certificate Display Area */}
        <div className="certificate-wrapper">
          {isGenerated ? (
            <div className="certificate-card" id="printableCertificate">
              <div className="cert-border">
                <div className="cert-inner">
                  <div className="cert-header">
                    <img src={Logo} alt="CRCE Cyber Lab" className="cert-logo" />
                    <div className="cert-inst-title">FR. CONCEICAO RODRIGUES COLLEGE OF ENGINEERING</div>
                    <div className="cert-lab-title">DEPARTMENT OF COMPUTER ENGINEERING • CRCE CYBER LAB</div>
                    <div className="cert-main-award">CERTIFICATE OF LAB COMPLETION</div>
                  </div>

                  <div className="cert-body">
                    <div className="cert-text-lead">This is to officially certify that</div>
                    <div className="cert-name-display">{studentName}</div>
                    {studentId && <div className="cert-id-display">Student ID: {studentId}</div>}
                    <div className="cert-text-sub">
                      has satisfactorily performed the required hands-on cybersecurity laboratory experiment,
                      analyzed attack vectors, observed system metrics, and demonstrated practical defense competencies for:
                    </div>
                    <div className="cert-exp-title">{experiment.title}</div>
                  </div>

                  <div className="cert-footer">
                    <div className="cert-meta-item">
                      <span className="meta-label">Date of Verification:</span>
                      <span className="meta-val">{completionDate}</span>
                    </div>
                    <div className="cert-seal">
                      <Award size={32} />
                      <span>VERIFIED</span>
                    </div>
                    <div className="cert-meta-item">
                      <span className="meta-label">Laboratory Module:</span>
                      <span className="meta-val">
                        {experiment.category} (CRCE-CS-{experiment.id.toString().padStart(2, '0')})
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="cert-form-card no-print">
              <div className="form-header">
                <FileText size={24} className="icon-blue" />
                <div>
                  <h3>Student Certificate Verification Form</h3>
                  <p>
                    Enter your official student details to generate your customized, print-ready
                    completion certificate.
                  </p>
                </div>
              </div>

              <form onSubmit={handleGenerate} className="student-info-form">
                <div className="form-field">
                  <label htmlFor="studentNameInput">
                    Student Full Name <span className="req">*</span>
                  </label>
                  <input
                    id="studentNameInput"
                    type="text"
                    value={studentName}
                    onChange={(e) => {
                      setStudentName(e.target.value)
                      if (nameError) setNameError('')
                    }}
                    placeholder="e.g., Alex Johnson"
                    autoFocus
                  />
                  {nameError && <div className="field-error">{nameError}</div>}
                </div>

                <div className="form-field">
                  <label htmlFor="studentIdInput">
                    Roll Number / Student ID <span className="opt">(Optional)</span>
                  </label>
                  <input
                    id="studentIdInput"
                    type="text"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    placeholder="e.g., 9482 / BE-COMP-B"
                  />
                </div>

                <div className="prerequisites-summary">
                  <h4>Verification Status</h4>
                  <div className="prereq-list">
                    <div className="prereq-item done">
                      <CheckCircle2 size={16} />
                      <span>Theory Documentation Studied</span>
                    </div>
                    <div className="prereq-item done">
                      <CheckCircle2 size={16} />
                      <span>Hands-on Experiment Executed</span>
                    </div>
                    <div className="prereq-item done">
                      <CheckCircle2 size={16} />
                      <span>Defensive Mitigations Explored</span>
                    </div>
                    <div className={`prereq-item ${isQuizCompleted ? 'done' : 'pending'}`}>
                      <CheckCircle2 size={16} />
                      <span>
                        Quiz Assessment {isQuizCompleted ? `Completed (${quizScore}%)` : 'Ready to Take'}
                      </span>
                    </div>
                  </div>
                </div>

                <button type="submit" className="generate-cert-btn">
                  <span>Generate Certificate</span>
                  <ArrowRight size={16} />
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Learning Outcomes Checklist */}
        <div className="panel outcomes-panel no-print">
          <div className="panel-header">
            <h3>Verified Lab Competencies</h3>
          </div>
          <div className="outcomes-list">
            {competencies.map((comp, idx) => (
              <div key={idx} className="outcome-item">
                <CheckCircle2 size={18} className="outcome-check" />
                <div>
                  <strong>{comp.title}</strong>
                  <p>{comp.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="assessment-summary-card">
            <h4>Assessment Status</h4>
            <div className="status-row">
              <span className="label">Evaluation Mode:</span>
              <span className="value">Practical & Theoretical</span>
            </div>
            <div className="status-row">
              <span className="label">Quiz Completion:</span>
              <span className={`value ${isQuizCompleted ? 'status-pass' : 'status-pending'}`}>
                {isQuizCompleted ? `Passed (${quizScore}%)` : 'Not yet attempted'}
              </span>
            </div>
            <div className="status-row">
              <span className="label">Institutional Credential:</span>
              <span className="value">Department of Computer Engineering</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LabReviewView
