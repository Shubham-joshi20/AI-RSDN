
// import { useState } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router'
import './App.css'
import Layout from './pages/Layout'
import Visualization from './pages/Visualization'


function App() {
  // const [count, setCount] = useState(0)

  return (
    <BrowserRouter>
      <Routes>
        <Route path='/' element={<Layout/>}>
          <Route path='/visualization' element={<Visualization/>} />
          <Route path='/algorithm' element={<></>} />
          <Route path='/about' element={<></>} />
        </Route>
      </Routes>

    </BrowserRouter>
  )
}

export default App
