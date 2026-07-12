import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import logo from '../images.png';

export default function Register() {
  const [formData, setFormData] = useState({
    name: '',
    rollNo: '',
    password: '',
    department: '',
    section: '',
    batch: '',
  });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.auth.register({ ...formData, role: 'STUDENT' });
      navigate('/login');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-12 text-white">
      <div className="max-w-md w-full bg-slate-900 rounded-3xl shadow-2xl p-8 border border-slate-800/80 animate-scale-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-yellow-500/10 border border-yellow-500/25 rounded-full mb-4 p-2 overflow-hidden">
            <img 
              src={logo} 
              alt="Quizmoz Logo" 
              className="w-full h-full object-cover rounded-full brightness-115"
            />
          </div>
          <h1 className="text-3xl font-black text-white">Student Registration</h1>
          <p className="text-sm text-slate-400 mt-1">Create your account to start taking quizzes</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-955/50 text-red-400 text-sm rounded-xl border border-red-900/50">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-450 uppercase mb-1">Full Name</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-[#7c3aed] text-white outline-none font-medium placeholder-slate-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-455 uppercase mb-1">Roll Number</label>
              <input
                type="text"
                required
                value={formData.rollNo}
                onChange={(e) => setFormData({ ...formData, rollNo: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-[#7c3aed] text-white outline-none font-medium placeholder-slate-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-455 uppercase mb-1">Password</label>
              <input
                type="password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-[#7c3aed] text-white outline-none font-medium placeholder-slate-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-455 uppercase mb-1">Department</label>
              <input
                type="text"
                required
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-[#7c3aed] text-white outline-none font-medium placeholder-slate-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-455 uppercase mb-1">Batch</label>
              <input
                type="text"
                required
                value={formData.batch}
                onChange={(e) => setFormData({ ...formData, batch: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-[#7c3aed] text-white outline-none font-medium placeholder-slate-500 transition-all"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-455 uppercase mb-1">Section (Optional)</label>
              <input
                type="text"
                value={formData.section}
                onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-[#7c3aed] text-white outline-none font-medium placeholder-slate-500 transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-[#7c3aed] text-white py-3 rounded-xl font-bold hover:bg-[#6d28d9] transition-all shadow-lg shadow-[#7c3aed]/15 mt-4"
          >
            Register Now
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-slate-400 text-sm">
            Already have an account?{' '}
            <Link to="/login" className="text-yellow-400 font-extrabold hover:text-yellow-500 hover:underline">
              Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
