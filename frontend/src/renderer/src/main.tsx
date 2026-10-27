import { useState } from 'react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './Sass/index.scss'
import { createHashRouter, RouterProvider } from 'react-router'
import Header from './Layouts/Header'
import { ToastContainer } from 'react-toastify'
import Home from './Layouts/Home'
import Lab from './Layouts/Lab'


const Main = () => {
  const [menuVisiblity, setMenuVisiblity] = useState<boolean>(true)

  const router = createHashRouter([
    {
      path: '/',
      element: <App />,
    },
    {
      path: '/home',
      element: <Home setMenuVisiblity={setMenuVisiblity} />,
    },
    {
      path: '/lab',
      element: <Lab setMenuVisiblity={setMenuVisiblity} />,
    },
  ])

  return (
    <>
      <ToastContainer
        position="bottom-right"
        autoClose={5000}
        newestOnTop={true}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="dark"
        limit={2}
      />
      <Header
        menuVisiblity={menuVisiblity}
      />
      <RouterProvider router={router} />
    </>
  )
}



createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Main />
  </StrictMode>,
)
