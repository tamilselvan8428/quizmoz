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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <nav className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <img 
            src={logo} 
            alt="Quizmoz Logo" 
            className="w-10 h-10 object-contain"
          />
          <span className="text-xl font-bold text-gray-900">Quizmoz</span>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-4">
            <Link to="/" className="text-gray-600 hover:text-indigo-600 font-medium flex items-center gap-1">
              <LayoutDashboard className="w-4 h-4" /> Dashboard
            </Link>
            {user.role === 'STUDENT' && (
              <Link to="/student/learning" className="text-gray-600 hover:text-indigo-600 font-medium flex items-center gap-1">
                <GraduationCap className="w-4 h-4" /> Learning
              </Link>
            )}
          </div>

          <div className="flex items-center gap-4 border-l pl-4">
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
              className="flex items-center gap-2 text-left hover:bg-gray-50 p-1 rounded-lg transition-colors group"
            >
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-gray-900 group-hover:text-indigo-600">{user.name}</p>
                <p className="text-xs text-gray-500 uppercase tracking-wider">{user.role}</p>
              </div>
              <UserCircle className="w-8 h-8 text-gray-400 group-hover:text-indigo-500" />
            </button>
            <button
              onClick={() => {
                onLogout();
                navigate('/login');
              }}
              className="p-2 text-gray-400 hover:text-red-600 transition-colors"
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 relative">
            <button 
              onClick={() => setShowEditProfile(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
            
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Edit Profile</h2>
            
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
                  {error}
                </div>
              )}
              {success && (
                <div className="p-3 bg-green-50 text-green-600 text-sm rounded-lg border border-green-100">
                  {success}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Roll Number / ID</label>
                <input
                  type="text"
                  required
                  value={formData.rollNo}
                  onChange={(e) => setFormData({ ...formData, rollNo: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                <input
                  type="text"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              {user.role === 'STUDENT' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Section</label>
                    <input
                      type="text"
                      value={formData.section}
                      onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Batch</label>
                    <input
                      type="text"
                      value={formData.batch}
                      onChange={(e) => setFormData({ ...formData, batch: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password (leave blank to keep current)</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 text-white py-2 rounded-lg font-semibold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
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
