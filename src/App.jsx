import { useState } from 'react'
import Login from './Pages/Login.jsx'
import Dashboard from './Pages/Dashboard.jsx'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => !!sessionStorage.getItem('tbToken')
  )

  return isAuthenticated ? (
    <Dashboard />
  ) : (
    <Login onLoginSuccess={() => setIsAuthenticated(true)} />
  )
}

export default App