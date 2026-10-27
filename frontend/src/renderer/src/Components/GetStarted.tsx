import { Dispatch, SetStateAction } from 'react'
import Hello from '../Assets/Hello.svg'
import type { CheckComponent, CheckPoint } from '@renderer/Layouts/Welcome'
import '../Sass/Components/GetStarted.scss'

interface PropType {
    setCheckPoint: Dispatch<SetStateAction<CheckPoint[]>>
    setCheckComponent: Dispatch<SetStateAction<CheckComponent>>
}
const GetStarted = ({ setCheckPoint, setCheckComponent }: PropType) => {
    const handleCheckPoint = (prev: CheckPoint[]): CheckPoint[] => {
        return prev.map((item) => {
            if (item.id == 'gs') {
                return { ...item, state: 'done' }
            }
            if (item.id == 'tc') {
                return { ...item, state: 'active' }
            }
            return item
        })
    }
    return (
        <div className="getting-started">
            <div className='cp-img'>
                <img src={Hello} alt="hello" />
            </div>
            <div className="cp-text">
                <h1>Welcome to CRCE Cyber Lab</h1>
                <p>
                    CRCE Cyber Lab is a hands-on learning platform designed to help you
                    explore cybersecurity, practice ethical hacking, and strengthen your
                    technical skills through interactive labs and real-world experiments
                </p>
                <p>
                    Follow a few simple steps to set up your environment and start your
                    cybersecurity journey.
                </p>
                <button
                    type="button"
                    onClick={() => {
                        setCheckPoint(handleCheckPoint)
                        setCheckComponent('term-cond')
                    }}
                >
                    Next
                </button>
            </div>
        </div>
    )
}

export default GetStarted