import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import logo from '../images.png';

export default function Login({ onLogin }) {
  const [rollNo, setRollNo] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const data = await api.auth.login(rollNo, password);
      onLogin(data.user);
      navigate('/');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 text-white">
      <div className="max-w-md w-full bg-slate-900 rounded-3xl shadow-2xl p-8 border border-slate-800/80 animate-scale-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-yellow-500/10 border border-yellow-500/25 rounded-full mb-4 p-3.5">
            <img 
              src={logo} 
              alt="Quizmoz Logo" 
              className="w-full h-full object-contain brightness-115 drop-shadow-[0_0_8px_rgba(236,191,33,0.3)]"
            />
          </div>
          <h1 className="text-3xl font-black text-white">Welcome Back</h1>
          <p className="text-sm text-slate-400 mt-1">Login to access your dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-3 bg-red-955/50 text-red-400 text-sm rounded-xl border border-red-900/50">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Roll Number / ID</label>
            <input
              type="text"
              required
              value={rollNo}
              onChange={(e) => setRollNo(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-[#2059a1] text-white outline-none font-medium placeholder-slate-500 transition-all"
              placeholder="Enter your roll no or admin id"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-[#2059a1] text-white outline-none font-medium placeholder-slate-500 transition-all"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-[#2059a1] text-white py-3 rounded-xl font-bold hover:bg-[#1a4b87] transition-all shadow-lg shadow-[#2059a1]/15"
          >
            Sign In
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-850 text-center">
          <p className="text-slate-400 text-sm">
            Don't have an account?{' '}
            <Link to="/register" className="text-yellow-400 font-extrabold hover:text-yellow-500 hover:underline">
              Register as Student
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
