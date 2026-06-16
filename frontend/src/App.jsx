import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { api } from './lib/api.js';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import AdminDashboard from './pages/admin/AdminDashboard.jsx';
import StaffDashboard from './pages/staff/StaffDashboard.jsx';
import CreateQuiz from './pages/staff/CreateQuiz.jsx';
import StudentDashboard from './pages/student/StudentDashboard.jsx';
import QuizPlayer from './pages/student/QuizPlayer.jsx';
import Learning from './pages/student/Learning.jsx';
import Layout from './components/Layout.jsx';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('current_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
  };

  const handleUpdateUser = (userData) => {
    setUser(userData);
    localStorage.setItem('current_user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    api.auth.logout();
    setUser(null);
  };

  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={!user ? <Login onLogin={handleLogin} /> : <Navigate to="/" />} />
        <Route path="/register" element={!user ? <Register /> : <Navigate to="/" />} />
        
        <Route element={<Layout user={user} onLogout={handleLogout} onUpdateUser={handleUpdateUser} />}>
          <Route path="/" element={
            user?.role === 'ADMIN' ? <AdminDashboard /> :
            user?.role === 'STAFF' ? <StaffDashboard /> :
            user?.role === 'STUDENT' ? <StudentDashboard /> :
            <Navigate to="/login" />
          } />
          
          {/* Staff Routes */}
          <Route path="/staff/create-quiz" element={user?.role === 'STAFF' ? <CreateQuiz /> : <Navigate to="/" />} />
          <Route path="/staff/edit-quiz/:id" element={user?.role === 'STAFF' ? <CreateQuiz /> : <Navigate to="/" />} />
          
          {/* Student Routes */}
          <Route path="/student/quiz/:id" element={user?.role === 'STUDENT' ? <QuizPlayer user={user} /> : <Navigate to="/" />} />
          <Route path="/student/learning" element={user?.role === 'STUDENT' ? <Learning /> : <Navigate to="/" />} />
        </Route>

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}
