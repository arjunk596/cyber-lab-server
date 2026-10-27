import Splash from "./Layouts/Splash"
import Welcome from "./Layouts/Welcome"

const App = () => {
  return (
    localStorage.getItem("agreed")!=='true' ?
      <Welcome />
      :
      <Splash />
  )
}

export default App