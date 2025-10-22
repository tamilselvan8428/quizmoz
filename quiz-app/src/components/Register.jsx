import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import '../styles/login.css'

const Register = ({ register }) => {
  const [formData, setFormData] = useState({
    name: '',
    rollNumber: '',
    password: '',
    department: '',
    section: '',
    batch: ''
  })
  const [message, setMessage] = useState({ text: '', type: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const navigate = useNavigate()

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)
    setMessage({ text: '', type: '' })

    try {
      // Client-side validation
      if (!formData.name || !formData.rollNumber || !formData.password || 
          !formData.department || !formData.batch) {
        throw new Error('Please fill in all required fields')
      }

      // Add student role automatically
      const studentData = {
        ...formData,
        role: 'student' // Force role to be student
      }

      const result = await register(studentData)
      
      if (result.success) {
        setMessage({ 
          text: result.message || 'Registration successful! Waiting for admin approval.', 
          type: 'success' 
        })
        setTimeout(() => navigate('/login'), 2000)
      } else {
        throw new Error(result.message || 'Registration failed')
      }
    } catch (err) {
      setMessage({ 
        text: err.message, 
        type: 'error' 
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="login-container">
      <div className="login-box">
        <h2>Student Registration</h2>
        
        {message.text && (
          <div className={`alert ${message.type}`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Full Name *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>
          
          <div className="form-group">
            <label>Roll Number *</label>
            <input
              type="text"
              name="rollNumber"
              value={formData.rollNumber}
              onChange={handleChange}
              required
            />
          </div>
          
          <div className="form-group">
            <label>Password *</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              minLength="6"
            />
            <small className="hint">(Minimum 6 characters)</small>
          </div>
          
          <div className="form-group">
            <label>Department *</label>
            <input
              type="text"
              name="department"
              value={formData.department}
              onChange={handleChange}
              required
            />
          </div>
          
          <div className="form-group">
            <label>Batch *</label>
            <input
              type="text"
              name="batch"
              value={formData.batch}
              onChange={handleChange}
              required
              placeholder="e.g., 2023"
            />
          </div>
          
          <div className="form-group">
            <label>Section *</label>
            <input
              type="text"
              name="section"
              value={formData.section}
              onChange={handleChange}
              required
            />
          </div>
          
          <button 
            type="submit" 
            disabled={isSubmitting}
            className={isSubmitting ? 'submitting' : ''}
          >
            {isSubmitting ? 'Registering...' : 'Register'}
          </button>
        </form>
        
        <div className="register-link">
          Already have an account? <Link to="/login">Login</Link>
        </div>
      </div>
    </div>
  )
}

export default Register