import Markdown from 'react-markdown'
import PullToRefresh from 'react-simple-pull-to-refresh'
import remarkGfm from 'remark-gfm'
import { useNavigate } from 'react-router'
import { ArrowLeft } from 'lucide-react'
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

const LabInfo = ({ refetch, error, experiment, currBtnInfo, loading, labInfo }: PropType) => {
    const navigate = useNavigate()
    return (
        <div className="main">
            <PullToRefresh
                onRefresh={refetch}
                pullingContent={<p style={{ textAlign: 'center', padding: '10px' }}>&#8615;&nbsp;&nbsp;Pull To refresh&nbsp;&nbsp;&#8615;</p>}
                isPullable={error}
            >
                <div className="heading">
                    <button type="button" onClick={() => navigate('/home')}><ArrowLeft size={30} /></button>
                    <h2 className="heading-title">{experiment?.title} - {currBtnInfo.toLocaleUpperCase()}</h2>
                </div>

                {loading ?
                    <h1 className='loading-text'>Fetching Content…</h1>
                    :
                    error ?
                        <h1 className="error">
                            Error 404: Limits Not Found.
                            <span className="error-hint">Something glitched while loading this lab — pull down to try again.</span>
                        </h1>
                        :
                        <div className="lab-info">
                            <Markdown
                                remarkPlugins={[remarkGfm]}
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
                                    )

                                }}
                            >
                                {labInfo}
                            </Markdown>
                        </div>
                }
            </PullToRefresh>
        </div>
    )
}

export default LabInfo