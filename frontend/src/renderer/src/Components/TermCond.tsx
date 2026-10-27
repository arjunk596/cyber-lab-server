import { Dispatch, SetStateAction, Fragment } from 'react'
import termsAndConditionsData from '@renderer/Constant/termsAndConditionsData'
import type { CheckComponent, CheckPoint } from '@renderer/Layouts/Welcome'
import Paper from '../Assets/T&C.png'
import '../Sass/Components/TermCond.scss'

interface PropType {
    setCheckPoint: Dispatch<SetStateAction<CheckPoint[]>>
    setCheckComponent: Dispatch<SetStateAction<CheckComponent>>
    setAgreed: Dispatch<SetStateAction<boolean>>
}

const TermCond = ({ setCheckPoint, setCheckComponent, setAgreed }: PropType) => {
    const handleBackCheckPoint = (prev: CheckPoint[]): CheckPoint[] => {
        return prev.map((item) => {
            if (item.id == 'gs') {
                return { ...item, state: 'active' }
            }
            if (item.id == 'tc') {
                return { ...item, state: null }
            }
            return item
        })
    }

    const handleNextCheckPoint = (prev:CheckPoint[]):CheckPoint[] => {
        return prev.map((item) => {
            if (item.id == 'tc') {
                return { ...item, state: 'done' }
            }
            if (item.id == 'pr') {
                return { ...item, state: 'active' }
            }
            return item
        })
    }

    return (
        <div className="term-cond">
            <div className='cp-img'>
                <img src={Paper} alt="hello" />
            </div>
            <div className="cp-text">
                <h1>Term & Condition</h1>
                <p>Welcome to CRCE Cyber Lab. By accessing and using this platform, you agree to comply with the following terms and conditions.</p>
                <div className="agreement-detail">
                    {termsAndConditionsData.map((item) => {
                        return (
                            <Fragment key={item.title}>
                                <h3>{item.title}</h3>
                                <p>{item.description}</p>
                            </Fragment>
                        )
                    })}
                </div>
                <div className="btn-ctn">
                    <button
                        type="button"
                        className='back-btn'
                        onClick={() => {
                            setCheckPoint(handleBackCheckPoint)
                            setCheckComponent('get-started')
                        }}
                    >
                        Back
                    </button>
                    <button
                        type="button"
                        className='agree-btn'
                        onClick={() => {
                            setAgreed(true)
                            setCheckPoint(handleNextCheckPoint)
                            setCheckComponent('pre-requisite')
                        }}
                    >
                        I Agree
                    </button>
                </div>
            </div>

        </div>
    )
}

export default TermCond