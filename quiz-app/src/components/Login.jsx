import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import '../styles/login.css'

const Login = ({ login }) => {
  const [rollNumber, setRollNumber] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    const result = await login(rollNumber, password)
    if (result.success) {
      navigate(`/${result.user.role}`)
    } else {
      setMessage(result.message)
    }
  }

  return (
    <div className="login-container">
      <img src="/logo.webp" alt="Logo" className="login-logo" />
      <div className="login-box">
        <h2>Login</h2>
        {message && <div className="alert">{message}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Roll Number</label>
            <input
              type="text"
              value={rollNumber}
              onChange={(e) => setRollNumber(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit">Login</button>
        </form>
        <div className="register-link">
          Don't have an account? <Link to="/register">Register</Link>
        </div>
      </div>
    </div>
  )
}

export default Login