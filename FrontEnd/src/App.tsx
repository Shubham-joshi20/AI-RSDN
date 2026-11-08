
// import { useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import './App.css'
import Layout from './pages/Layout'
import Visualization from './pages/Visualization'
import Algorithms from './pages/Algorithms'
import CampusDemo from './pages/CampusDemo'


function App() {
  // const [count, setCount] = useState(0)

  return (
    <BrowserRouter>
      <Routes>
        <Route path='/' element={<Layout/>}>
          <Route index element={<CampusDemo />} />
          <Route path='/campus-demo' element={<CampusDemo />} />
          <Route path='/visualization' element={<Visualization/>} />
          <Route path='/algorithm' element={<Algorithms />} />
          <Route path='/about' element={<></>} />
          <Route path='*' element={<Navigate to='/visualization' replace />} />
        </Route>
      </Routes>

    </BrowserRouter>
  )
}

export default App
