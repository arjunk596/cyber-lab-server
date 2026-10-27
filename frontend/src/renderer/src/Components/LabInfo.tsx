import React from 'react'
import Markdown from 'react-markdown'
import PullToRefresh from 'react-simple-pull-to-refresh'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import type { Experiment } from '@shared/experiment'
import '../Sass/Components/LabInfo.scss'

interface PropType {
  refetch: () => Promise<void>
  error: boolean
  experiment: Experiment | null
  currBtnInfo: string
  loading: boolean
  labInfo: string
}

const LabInfo: React.FC<PropType> = ({
  refetch,
  error,
  experiment,
  currBtnInfo,
  loading,
  labInfo
}) => {
  return (
    <div className="main">
      <PullToRefresh
        onRefresh={refetch}
        pullingContent={
          <p style={{ textAlign: 'center', padding: '10px' }}>
            &#8615;&nbsp;&nbsp;Pull to refresh&nbsp;&nbsp;&#8615;
          </p>
        }
        isPullable={error}
      >
        <div className="heading">
          <h2 className="heading-title">
            <span>{experiment?.title}</span>
            <span className="section-divider">/</span>
            <span className="section-label">{currBtnInfo.toUpperCase()}</span>
          </h2>
        </div>

        {loading ? (
          <div className="loading-box">
            <div id="loading" style={{ width: 28, height: 28, marginBottom: 12 }} />
            <span className="loading-text">Loading {currBtnInfo} documentation…</span>
          </div>
        ) : error ? (
          <div className="error-box">
            <h3>Documentation Retrieval Notice</h3>
            <p className="error-hint">
              Unable to reach the remote repository server for this section. You can pull down or click
              below to retry fetching.
            </p>
            <button type="button" className="retry-btn" onClick={() => refetch()}>
              Retry Connection
            </button>
          </div>
        ) : (
          <div className="lab-info">
            <Markdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeKatex]}
              components={{
                a: ({ href, children }) => (
                  <a
                    href={href}
                    onClick={(e) => {
                      if (href?.startsWith('http')) {
                        e.preventDefault()
                        window.api.openURL(href)
                      }
                    }}
                  >
                    {children}
                  </a>
                ),
                table: ({ children }) => (
                  <div className="table">
                    <table>{children}</table>
                  </div>
                ),
                code: ({ className, children, ...props }) => {
                  return (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  )
                }
              }}
            >
              {labInfo}
            </Markdown>
          </div>
        )}
      </PullToRefresh>
    </div>
  )
}

export default LabInfo