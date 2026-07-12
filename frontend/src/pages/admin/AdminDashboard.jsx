import { useState, useEffect } from 'react';
import { api } from '../../lib/api.js';
import { Users, UserPlus, Trash2, Shield, User as UserIcon, Key } from 'lucide-react';

export default function AdminDashboard() {
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [batchFilter, setBatchFilter] = useState('');
  const [secFilter, setSecFilter] = useState('');
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [showUpdatePassword, setShowUpdatePassword] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [newStaff, setNewStaff] = useState({
    name: '',
    rollNo: '',
    password: '',
    department: '',
  });

  const fetchUsers = async () => {
    try {
      const data = await api.users.getAll();
      setUsers(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleAddStaff = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.auth.register({
        ...newStaff,
        role: 'STAFF',
      });
      fetchUsers();
      setShowAddStaff(false);
      setNewStaff({ name: '', rollNo: '', password: '', department: '' });
      setSuccess('Staff account created successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    setError('');
    try {
      await api.users.delete(selectedUser._id);
      fetchUsers();
      setShowDeleteConfirm(false);
      setSelectedUser(null);
      setSuccess('User deleted successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.users.updatePassword(selectedUser._id, newPassword);
      setSuccess('Password updated successfully');
      setTimeout(() => setSuccess(''), 3000);
      setShowUpdatePassword(false);
      setNewPassword('');
      setSelectedUser(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const depts = Array.from(new Set(users.map(u => u.department).filter(Boolean))).sort();
  const batches = Array.from(new Set(users.map(u => u.batch).filter(Boolean))).sort();
  const secs = Array.from(new Set(users.map(u => u.section).filter(Boolean))).sort();

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          user.rollNo.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = !roleFilter || user.role === roleFilter;
    const matchesDept = !deptFilter || user.department === deptFilter;
    const matchesBatch = !batchFilter || user.batch === batchFilter;
    const matchesSec = !secFilter || user.section === secFilter;
    return matchesSearch && matchesRole && matchesDept && matchesBatch && matchesSec;
  });

  return (
    <div className="space-y-8 text-white">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-white">Admin Dashboard</h1>
          <p className="text-slate-450 mt-1">Manage users and system access</p>
        </div>
        <button
          onClick={() => setShowAddStaff(true)}
          className="bg-[#7c3aed] text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-[#6d28d9] transition-all shadow-lg shadow-[#7c3aed]/10"
        >
          <UserPlus className="w-5 h-5" /> Add Staff Account
        </button>
      </div>

      {error && (
        <div className="bg-red-955/50 border border-red-900/50 text-red-400 px-4 py-3 rounded-xl flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-450 hover:text-red-300 font-bold">×</button>
        </div>
      )}

      {success && (
        <div className="bg-green-955/50 border border-green-900/50 text-green-400 px-4 py-3 rounded-xl flex items-center justify-between">
          <span>{success}</span>
          <button onClick={() => setSuccess('')} className="text-green-450 hover:text-green-300 font-bold">×</button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900/40 p-6 rounded-2xl border border-slate-800/80">
          <div className="flex items-center gap-4">
            <div className="bg-blue-950/50 border border-blue-900/35 p-3 rounded-xl text-blue-400">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Total Users</p>
              <p className="text-2xl font-black text-white mt-1">{users.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-900/40 p-6 rounded-2xl border border-slate-800/80">
          <div className="flex items-center gap-4">
            <div className="bg-yellow-955/50 border border-yellow-900/35 p-3 rounded-xl text-yellow-450">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Staff Members</p>
              <p className="text-2xl font-black text-white mt-1 text-yellow-400">
                {users.filter(u => u.role === 'STAFF').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-slate-900/40 p-6 rounded-2xl border border-slate-800/80">
          <div className="flex items-center gap-4">
            <div className="bg-emerald-950/50 border border-emerald-900/35 p-3 rounded-xl text-emerald-400">
              <UserIcon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Students</p>
              <p className="text-2xl font-black text-white mt-1 text-emerald-400">
                {users.filter(u => u.role === 'STUDENT').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800/80 rounded-3xl shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-850 flex flex-col xl:flex-row gap-4 items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="w-2 h-5 bg-indigo-500 rounded-full inline-block" />
            User Management
          </h2>
          <div className="flex flex-wrap gap-3 items-center w-full xl:w-auto">
            <input
              type="text"
              placeholder="Search name or ID/roll no..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-white w-full sm:w-64 transition-all placeholder-slate-500"
            />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-white transition-all cursor-pointer"
            >
              <option value="">All Roles</option>
              <option value="ADMIN">Admin</option>
              <option value="STAFF">Staff</option>
              <option value="STUDENT">Student</option>
            </select>
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-white transition-all cursor-pointer"
            >
              <option value="">All Departments</option>
              {depts.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
            <select
              value={batchFilter}
              onChange={(e) => setBatchFilter(e.target.value)}
              className="px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-white transition-all cursor-pointer"
            >
              <option value="">All Batches</option>
              {batches.map(batch => (
                <option key={batch} value={batch}>{batch}</option>
              ))}
            </select>
            <select
              value={secFilter}
              onChange={(e) => setSecFilter(e.target.value)}
              className="px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-white transition-all cursor-pointer"
            >
              <option value="">All Sections</option>
              {secs.map(sec => (
                <option key={sec} value={sec}>{sec}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="overflow-x-auto animate-fade-in-up">
          <table className="w-full text-left">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-850">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-slate-455 uppercase tracking-wider">Name</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-455 uppercase tracking-wider">Roll No / ID</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-455 uppercase tracking-wider">Role</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-455 uppercase tracking-wider">Department</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-455 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-slate-450 font-medium">
                    No users found matching the selected filters.
                  </td>
                </tr>
              ) : (
                filteredUsers.map(user => (
                  <tr key={user._id} className="hover:bg-slate-850/40 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap font-semibold text-white">{user.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-350">{user.rollNo}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                        user.role === 'ADMIN' ? 'bg-red-955/50 border-red-900/30 text-red-400' :
                        user.role === 'STAFF' ? 'bg-yellow-950 border border-yellow-900/30 text-yellow-400' :
                        'bg-emerald-950 border border-emerald-900/30 text-emerald-400'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-350 text-sm">
                      <div>{user.department || 'N/A'}</div>
                      {user.role === 'STUDENT' && (
                        <div className="text-xs text-slate-500 mt-0.5">
                          {user.batch || 'N/A'} {user.section && `• Sec ${user.section}`}
                        </div>
                      )}
                    </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-3">
                      {user.role !== 'ADMIN' && (
                        <>
                          <button
                            onClick={() => {
                              setSelectedUser(user);
                              setShowUpdatePassword(true);
                            }}
                            className="p-1 text-slate-450 hover:text-[#10b981] transition-all"
                            title="Update Password"
                          >
                            <Key className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedUser(user);
                              setShowDeleteConfirm(true);
                            }}
                            className="p-1 text-slate-450 hover:text-red-400 transition-all"
                            title="Delete User"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      </div>

      {showAddStaff && (
        <div className="fixed inset-0 bg-black/65 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl shadow-2xl max-w-md w-full p-8 animate-scale-in">
            <h2 className="text-2xl font-black text-white mb-6">Add New Staff</h2>
            <form onSubmit={handleAddStaff} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-450 uppercase mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={newStaff.name}
                  onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-[#7c3aed] text-white outline-none font-medium placeholder-slate-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-450 uppercase mb-1">Staff ID / Roll No</label>
                <input
                  type="text"
                  required
                  value={newStaff.rollNo}
                  onChange={(e) => setNewStaff({ ...newStaff, rollNo: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-[#7c3aed] text-white outline-none font-medium placeholder-slate-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-455 uppercase mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={newStaff.password}
                  onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-[#7c3aed] text-white outline-none font-medium placeholder-slate-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-455 uppercase mb-1">Department</label>
                <input
                  type="text"
                  required
                  value={newStaff.department}
                  onChange={(e) => setNewStaff({ ...newStaff, department: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-[#7c3aed] text-white outline-none font-medium placeholder-slate-500 transition-all"
                />
              </div>
              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddStaff(false)}
                  className="flex-1 px-4 py-2.5 border border-slate-800 text-slate-350 rounded-xl hover:bg-slate-850 transition-colors font-bold text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-[#7c3aed] text-white rounded-xl hover:bg-[#6d28d9] transition-colors font-bold text-sm shadow-lg shadow-[#7c3aed]/15"
                >
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showUpdatePassword && (
        <div className="fixed inset-0 bg-black/65 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl shadow-2xl max-w-md w-full p-8 animate-scale-in">
            <h2 className="text-2xl font-black text-white mb-2">Update Password</h2>
            <p className="text-slate-350 text-sm mb-6">Updating password for {selectedUser?.name}</p>
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-450 uppercase mb-1">New Password</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-[#7c3aed] text-white outline-none font-medium placeholder-slate-500 transition-all"
                />
              </div>
              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowUpdatePassword(false);
                    setSelectedUser(null);
                    setNewPassword('');
                    setError('');
                  }}
                  className="flex-1 px-4 py-2.5 border border-slate-800 text-slate-355 rounded-xl hover:bg-slate-855 transition-colors font-bold text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-[#7c3aed] text-white rounded-xl hover:bg-[#6d28d9] transition-colors font-bold text-sm shadow-lg shadow-[#7c3aed]/15"
                >
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/65 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl shadow-2xl max-w-md w-full p-8 animate-scale-in">
            <div className="w-16 h-16 bg-red-500/10 border border-red-500/25 rounded-full flex items-center justify-center mx-auto mb-6 text-red-500">
              <Trash2 className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-black text-white text-center mb-2">Delete User</h2>
            <p className="text-slate-355 text-center mb-8 text-sm leading-relaxed">
              Are you sure you want to delete <span className="font-bold text-white">{selectedUser?.name}</span>? This action cannot be undone.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setSelectedUser(null);
                  setError('');
                }}
                className="flex-1 px-4 py-2.5 border border-slate-800 text-slate-355 rounded-xl hover:bg-slate-855 transition-colors font-bold text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteUser}
                className="flex-1 px-4 py-2.5 bg-red-650 text-white rounded-xl hover:bg-red-750 transition-colors font-bold text-sm shadow-lg shadow-red-650/15"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
