import { Outlet, Link, useNavigate, Navigate } from 'react-router-dom';
import { useState } from 'react';
import { LogOut, LayoutDashboard, GraduationCap, UserCircle, X, Loader2 } from 'lucide-react';
import { api } from '../lib/api.js';
import logo from '../images.png';

export default function Layout({ user, onLogout, onUpdateUser }) {
  const navigate = useNavigate();
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState({
    name: user?.name || '',
    rollNo: user?.rollNo || '',
    department: user?.department || '',
    section: user?.section || '',
    batch: user?.batch || '',
    password: '',
  });

  if (!user) return <Navigate to="/login" />;

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const updatedUser = await api.users.updateProfile(formData);
      onUpdateUser(updatedUser);
      setSuccess('Profile updated successfully');
      setTimeout(() => {
        setShowEditProfile(false);
        setSuccess('');
      }, 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <nav className="bg-slate-900/80 border-b border-slate-800/80 backdrop-blur-md px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <img 
            src={logo} 
            alt="Quizmoz Logo" 
            className="w-10 h-10 object-contain brightness-110 drop-shadow-[0_0_8px_rgba(236,191,33,0.3)]"
          />
          <span className="text-xl font-black text-white tracking-wide">Quizmoz</span>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-5">
            <Link to="/" className="text-slate-350 hover:text-yellow-400 font-semibold flex items-center gap-1.5 transition-colors">
              <LayoutDashboard className="w-4.5 h-4.5" /> Dashboard
            </Link>
            {user.role === 'STUDENT' && (
              <Link to="/student/learning" className="text-slate-350 hover:text-yellow-400 font-semibold flex items-center gap-1.5 transition-colors">
                <GraduationCap className="w-4.5 h-4.5" /> Learning
              </Link>
            )}
          </div>

          <div className="flex items-center gap-4 border-l border-slate-800 pl-4">
            <button 
              onClick={() => {
                setFormData({
                  name: user.name,
                  rollNo: user.rollNo,
                  department: user.department || '',
                  section: user.section || '',
                  batch: user.batch || '',
                  password: '',
                });
                setShowEditProfile(true);
              }}
              className="flex items-center gap-2 text-left hover:bg-slate-800/50 p-1.5 rounded-xl transition-all group"
            >
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-slate-200 group-hover:text-yellow-400 transition-colors">{user.name}</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{user.role}</p>
              </div>
              <UserCircle className="w-8 h-8 text-slate-400 group-hover:text-yellow-500 transition-colors" />
            </button>
            <button
              onClick={() => {
                onLogout();
                navigate('/login');
              }}
              className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800/40 rounded-xl transition-all"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </nav>

      <main className="flex-1 container mx-auto px-4 py-8">
        <Outlet />
      </main>

      {showEditProfile && (
        <div className="fixed inset-0 bg-black/65 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl shadow-2xl max-w-md w-full p-8 relative animate-scale-in">
            <button 
              onClick={() => setShowEditProfile(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            
            <h2 className="text-2xl font-black mb-6 flex items-center gap-2">
              <span className="w-2.5 h-6 bg-yellow-500 rounded-full inline-block" />
              Edit Profile
            </h2>
            
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-950/50 text-red-400 text-sm rounded-xl border border-red-900/50">
                  {error}
                </div>
              )}
              {success && (
                <div className="p-3 bg-green-950/50 text-green-400 text-sm rounded-xl border border-green-900/50">
                  {success}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-450 uppercase mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-[#2059a1] text-white outline-none font-medium placeholder-slate-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-450 uppercase mb-1">Roll Number / ID</label>
                <input
                  type="text"
                  required
                  value={formData.rollNo}
                  onChange={(e) => setFormData({ ...formData, rollNo: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-[#2059a1] text-white outline-none font-medium placeholder-slate-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-450 uppercase mb-1">Department</label>
                <input
                  type="text"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-[#2059a1] text-white outline-none font-medium placeholder-slate-500 transition-all"
                />
              </div>

              {user.role === 'STUDENT' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-450 uppercase mb-1">Section</label>
                    <input
                      type="text"
                      value={formData.section}
                      onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-[#2059a1] text-white outline-none font-medium placeholder-slate-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-450 uppercase mb-1">Batch</label>
                    <input
                      type="text"
                      value={formData.batch}
                      onChange={(e) => setFormData({ ...formData, batch: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-[#2059a1] text-white outline-none font-medium placeholder-slate-500 transition-all"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-450 uppercase mb-1">New Password (leave blank to keep current)</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-[#2059a1] text-white outline-none font-medium placeholder-slate-500 transition-all"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#2059a1] hover:bg-[#194680] text-white py-3 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-[#2059a1]/10 mt-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Changes'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
