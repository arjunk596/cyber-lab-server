import { useState, type Dispatch, type SetStateAction } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import GetStarted from '@renderer/Components/GetStarted'
import TermCond from '@renderer/Components/TermCond'
import Prerequisite from '@renderer/Components/Prerequisite'
import '../Sass/Layouts/Welcome.scss'

export interface CheckPoint {
  id: 'gs' | 'tc' | 'pr'
  state: null | 'active' | 'done'
}

export type CheckComponent = 'get-started' | 'term-cond' | 'pre-requisite'

const ORDER: CheckComponent[] = ['get-started', 'term-cond', 'pre-requisite']

const variants = {
  enter: (dir: number) => ({ opacity: 0, x: dir >= 0 ? 200 : -200 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir >= 0 ? -200 : 200 }),
}

const Welcome = () => {
  const [checkPoint, setCheckPoint] = useState<CheckPoint[]>([
    { id: 'gs', state: 'active' },
    { id: 'tc', state: null },
    { id: 'pr', state: null },
  ])
  const [checkComponent, setCheckComponent] = useState<CheckComponent>('get-started')
  const [direction, setDirection] = useState<number>(1)

  const goTo: Dispatch<SetStateAction<CheckComponent>> = (value) => {
    if (typeof value !== 'function') {
      setDirection(ORDER.indexOf(value) >= ORDER.indexOf(checkComponent) ? 1 : -1)
    }
    setCheckComponent(value)
  }

  const [agreed, setAgreed] = useState<boolean>(false)

  return (
    <section className='welcome'>
      <ul className='checkpoint'>
        {
          checkPoint.map((item, idx) => {
            return <li key={item.id} className={item.state ?? ''}>{idx + 1}</li>
          })
        }
      </ul>

      <AnimatePresence mode="wait" custom={direction}>
      {
        checkComponent === 'get-started' &&
        <motion.div
          key="get-started"
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
        <GetStarted
          setCheckPoint={setCheckPoint}
          setCheckComponent={goTo}
        />
        </motion.div>
      }
      {
        checkComponent === 'term-cond' &&
        <motion.div
          key="term-cond"
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
        <TermCond
          setCheckPoint={setCheckPoint}
          setCheckComponent={goTo}
          setAgreed={setAgreed}
        />
        </motion.div>
      }
      {
        checkComponent === 'pre-requisite' &&
        <motion.div
          key="pre-requisite"
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.1, ease: 'easeOut' }}
        >
        <Prerequisite
          setCheckPoint={setCheckPoint}
          setCheckComponent={goTo}
          agreed={agreed}
        />
        </motion.div>
      }
      </AnimatePresence>
    </section>
  )
}

export default Welcome