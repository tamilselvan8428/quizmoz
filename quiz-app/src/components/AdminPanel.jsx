import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import '../styles/admin.css';

const AdminPanel = ({ user, logout }) => {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [activeUsers, setActiveUsers] = useState([]);
  const [deletedUsers, setDeletedUsers] = useState([]);
  const [selectedPending, setSelectedPending] = useState([]);
  const [selectedActive, setSelectedActive] = useState([]);
  const [selectedDeleted, setSelectedDeleted] = useState([]);
  const [activeTab, setActiveTab] = useState('pending');
  const [message, setMessage] = useState({ text: '', type: '' });
  const [isLoading, setIsLoading] = useState({
    pending: false,
    active: false,
    deleted: false,
    action: false
  });
  const [filters, setFilters] = useState({
    role: '',
    department: '',
    section: '',
    batch: '',
    search: ''
  });
  const [showCreateStaffModal, setShowCreateStaffModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newStaff, setNewStaff] = useState({
    name: '',
    rollNumber: '',
    password: '',
    department: ''
  });
  const [passwordUpdateData, setPasswordUpdateData] = useState({
    userId: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [conflictResolutionData, setConflictResolutionData] = useState(null);

  const navigate = useNavigate();

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/login');
      return;
    }
    
    fetchPendingUsers();
    fetchActiveUsers();
    fetchDeletedUsers();
  }, []);

  const fetchPendingUsers = async () => {
    setIsLoading(prev => ({ ...prev, pending: true }));
    try {
      const res = await axios.get('/api/users/pending', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setPendingUsers(res.data.users || []);
    } catch (err) {
      handleApiError(err, 'Failed to fetch pending users');
    } finally {
      setIsLoading(prev => ({ ...prev, pending: false }));
    }
  };

  const fetchActiveUsers = async () => {
    setIsLoading(prev => ({ ...prev, active: true }));
    try {
      const res = await axios.get('/api/users', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setActiveUsers(res.data.users || []);
    } catch (err) {
      handleApiError(err, 'Failed to fetch active users');
    } finally {
      setIsLoading(prev => ({ ...prev, active: false }));
    }
  };

  const fetchDeletedUsers = async () => {
    setIsLoading(prev => ({ ...prev, deleted: true }));
    try {
      const res = await axios.get('/api/deleted-users', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setDeletedUsers(res.data.deletedUsers || []);
    } catch (err) {
      handleApiError(err, 'Failed to fetch deleted users');
    } finally {
      setIsLoading(prev => ({ ...prev, deleted: false }));
    }
  };

  const handleApiError = (err, defaultMessage) => {
    console.error(err);
    setMessage({
      text: err.response?.data?.message || defaultMessage,
      type: 'error'
    });
    if (err.response?.status === 401) {
      logout();
    }
  };

  const filterUsers = (users) => {
    return users.filter(user => {
      return (
        (filters.role === '' || user.role === filters.role) &&
        (filters.department === '' || (user.department && user.department.toLowerCase().includes(filters.department.toLowerCase()))) &&
        (filters.section === '' || (user.section && user.section.toLowerCase().includes(filters.section.toLowerCase()))) &&
        (filters.batch === '' || (user.batch && user.batch.toLowerCase().includes(filters.batch.toLowerCase()))) &&
        (filters.search === '' || 
          (user.name && user.name.toLowerCase().includes(filters.search.toLowerCase())) ||
          (user.rollNumber && user.rollNumber.toLowerCase().includes(filters.search.toLowerCase())))
      );
    });
  };

  const filteredPendingUsers = filterUsers(pendingUsers);
  const filteredActiveUsers = filterUsers(activeUsers);
  const filteredDeletedUsers = filterUsers(deletedUsers);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const resetFilters = () => {
    setFilters({
      role: '',
      department: '',
      section: '',
      batch: '',
      search: ''
    });
  };

  const handleApprove = async () => {
    if (selectedPending.length === 0) return;
    
    setIsLoading(prev => ({ ...prev, action: true }));
    try {
      const res = await axios.post(
        '/api/users/approve',
        { userIds: selectedPending },
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        }
      );
      
      setMessage({
        text: res.data.message || 'Users approved successfully',
        type: 'success'
      });
      fetchPendingUsers();
      fetchActiveUsers();
      setSelectedPending([]);
    } catch (err) {
      handleApiError(err, 'Failed to approve users');
    } finally {
      setIsLoading(prev => ({ ...prev, action: false }));
    }
  };

  const handleDelete = async () => {
    if (selectedActive.length === 0) return;
    
    if (!window.confirm(`Are you sure you want to delete ${selectedActive.length} user(s)?`)) {
      return;
    }

    setIsLoading(prev => ({ ...prev, action: true }));
    try {
      const results = await Promise.allSettled(
        selectedActive.map(id =>
          axios.delete(`/api/users/${id}`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
          })
        )
      );

      const failedDeletions = results.filter(r => r.status === 'rejected');
      if (failedDeletions.length > 0) {
        const errorMessages = failedDeletions.map(f => 
          f.reason.response?.data?.message || f.reason.message
        ).join(', ');
        
        throw new Error(`Some deletions failed: ${errorMessages}`);
      }

      setMessage({
        text: `${selectedActive.length} user(s) deleted successfully`,
        type: 'success'
      });
      fetchActiveUsers();
      fetchDeletedUsers();
      setSelectedActive([]);
    } catch (err) {
      handleApiError(err, err.message || 'Failed to delete users');
    } finally {
      setIsLoading(prev => ({ ...prev, action: false }));
    }
  };
  const handleRestore = async () => {
    if (selectedDeleted.length === 0) return;
    
    setIsLoading(prev => ({ ...prev, action: true }));
    setMessage({ text: '', type: '' });
    setConflictResolutionData(null); // Reset any previous conflict data
    
    try {
        const results = await Promise.allSettled(
            selectedDeleted.map(id =>
                axios.post(`/api/users/restore/${id}`, {}, {
                    headers: { 
                        Authorization: `Bearer ${localStorage.getItem('token')}`,
                        'Content-Type': 'application/json'
                    }
                }).catch(error => {
                    // Enhance error with detailed conflict information
                    if (error.response?.data?.errorType === 'ROLL_NUMBER_CONFLICT') {
                        return Promise.reject({
                            isConflictError: true,
                            failedId: id,
                            conflictData: error.response.data.conflictDetails,
                            status: 'conflict'
                        });
                    }
                    return Promise.reject({
                        isGenericError: true,
                        failedId: id,
                        message: error.response?.data?.message || error.message,
                        status: 'error'
                    });
                })
            )
        );

        // Process results
        const successfulRestores = results.filter(r => r.status === 'fulfilled');
        const failedRestores = results.filter(r => r.status === 'rejected');
        const conflictErrors = failedRestores.filter(f => f.reason.isConflictError);
        const otherErrors = failedRestores.filter(f => !f.reason.isConflictError);

        // Handle successful restores
        if (successfulRestores.length > 0) {
            setMessage(prev => ({
                text: `${prev.text ? prev.text + '\n' : ''}✅ Successfully restored ${successfulRestores.length} user(s)`,
                type: 'success'
            }));
            setSelectedDeleted(prev => prev.filter(id => 
                !successfulRestores.some(r => r.value.data.user?.id === id)
            ));
        }

        // Handle conflict errors
        if (conflictErrors.length > 0) {
            setConflictResolutionData({
                conflicts: conflictErrors.map(f => ({
                    deletedUserId: f.reason.conflictData.deletedUserId,
                    deletedUserName: f.reason.conflictData.deletedUserName,
                    existingUserId: f.reason.conflictData.existingUserId,
                    existingUserName: f.reason.conflictData.existingUserName,
                    rollNumber: f.reason.conflictData.rollNumber,
                    status: f.reason.conflictData.status
                })),
                remainingIds: selectedDeleted.filter(id => 
                    !successfulRestores.some(r => r.value.data.user?.id === id)
                )
            });

            setMessage(prev => ({
                text: `${prev.text ? prev.text + '\n' : ''}⚠️ ${conflictErrors.length} conflict(s) detected`,
                type: 'warning'
            }));
        }

        // Handle other errors
        if (otherErrors.length > 0) {
            const errorMessages = otherErrors.map(f => 
                `❌ Failed to restore user ${f.reason.failedId}: ${f.reason.message}`
            );

            setMessage(prev => ({
                text: `${prev.text ? prev.text + '\n' : ''}${errorMessages.join('\n')}`,
                type: prev.type === 'success' ? 'warning' : 'error'
            }));
        }

        // Refresh data
        await Promise.all([fetchDeletedUsers(), fetchActiveUsers()]);

    } catch (err) {
        console.error('Restore process error:', err);
        setMessage({
            text: `⛔ Critical error during restore process: ${err.message}`,
            type: 'error'
        });
    } finally {
        setIsLoading(prev => ({ ...prev, action: false }));
    }
};

// Conflict resolution handler
const handleResolveConflict = async (action, conflict) => {
    if (!action || !conflict) return;
    
    setIsLoading(prev => ({ ...prev, conflictResolution: true }));
    
    try {
        let response;
        
        if (action === 'change-roll') {
            const newRollNumber = prompt(`Enter new roll number for ${conflict.deletedUserName}:`);
            if (!newRollNumber) return;

            response = await axios.post(
                `/api/users/restore/${conflict.deletedUserId}`, 
                { newRollNumber },
                { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
            );
        } 
        else if (action === 'delete-conflict') {
            if (!confirm(`Are you sure you want to delete ${conflict.existingUserName} (${conflict.rollNumber})?`)) return;
            
            response = await axios.delete(
                `/api/users/${conflict.existingUserId}`,
                { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
            );
        }

        if (response?.data.success) {
            setMessage({
                text: `✅ Conflict resolved - ${action === 'change-roll' ? 
                    'User restored with new roll number' : 'Conflicting user deleted'}`,
                type: 'success'
            });
            
            // Refresh data and retry remaining restores
            await Promise.all([fetchDeletedUsers(), fetchActiveUsers()]);
            
            if (conflictResolutionData.remainingIds.length > 0) {
                setTimeout(() => handleRestore(), 1000);
            }
        }

        setConflictResolutionData(null);
        
    } catch (err) {
        setMessage({
            text: `⚠️ Failed to resolve conflict: ${err.response?.data?.message || err.message}`,
            type: 'error'
        });
    } finally {
        setIsLoading(prev => ({ ...prev, conflictResolution: false }));
    }
};

  const handlePermanentDelete = async () => {
    if (selectedDeleted.length === 0) return;
    
    if (!window.confirm(`Permanently delete ${selectedDeleted.length} user(s)? This cannot be undone.`)) {
      return;
    }

    setIsLoading(prev => ({ ...prev, action: true }));
    try {
      const results = await Promise.allSettled(
        selectedDeleted.map(id =>
          axios.delete(`/api/users/permanent/${id}`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
          })
        )
      );

      const failedDeletions = results.filter(r => r.status === 'rejected');
      if (failedDeletions.length > 0) {
        const errorMessages = failedDeletions.map(f => 
          f.reason.response?.data?.message || f.reason.message
        ).join(', ');
        
        throw new Error(`Some permanent deletions failed: ${errorMessages}`);
      }

      setMessage({
        text: `${selectedDeleted.length} user(s) permanently deleted`,
        type: 'success'
      });
      fetchDeletedUsers();
      setSelectedDeleted([]);
    } catch (err) {
      handleApiError(err, err.message || 'Failed to permanently delete users');
    } finally {
      setIsLoading(prev => ({ ...prev, action: false }));
    }
  };

  const handleCreateStaff = async (e) => {
    e.preventDefault();
    setIsLoading(prev => ({ ...prev, action: true }));
    
    try {
      if (!newStaff.name || !newStaff.rollNumber || !newStaff.password || !newStaff.department) {
        throw new Error('Please fill in all fields');
      }

      const staffData = {
        ...newStaff,
        role: 'staff',
        isApproved: true
      };

      const res = await axios.post('/api/users/staff', staffData,  {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      setMessage({
        text: 'Staff account created successfully',
        type: 'success'
      });
      setShowCreateStaffModal(false);
      setNewStaff({
        name: '',
        rollNumber: '',
        password: '',
        department: ''
      });
      fetchActiveUsers();
    } catch (err) {
      setMessage({
        text: err.response?.data?.message || err.message || 'Failed to create staff account',
        type: 'error'
      });
    } finally {
      setIsLoading(prev => ({ ...prev, action: false }));
    }
  };

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    
    if (passwordUpdateData.newPassword !== passwordUpdateData.confirmPassword) {
      setMessage({ text: 'Passwords do not match', type: 'error' });
      return;
    }

    setIsLoading(prev => ({ ...prev, action: true }));
    
    try {
      await axios.put(
        `/api/users/${passwordUpdateData.userId}/password`,
        { newPassword: passwordUpdateData.newPassword },
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        }
      );

      setMessage({
        text: 'Password updated successfully',
        type: 'success'
      });
      setShowPasswordModal(false);
      setPasswordUpdateData({
        userId: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (err) {
      setMessage({
        text: err.response?.data?.message || 'Failed to update password',
        type: 'error'
      });
    } finally {
      setIsLoading(prev => ({ ...prev, action: false }));
    }
  };

  const openPasswordModal = (userId) => {
    setPasswordUpdateData({
      userId,
      newPassword: '',
      confirmPassword: ''
    });
    setShowPasswordModal(true);
  };

  const togglePendingSelect = id => {
    setSelectedPending(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleActiveSelect = id => {
    setSelectedActive(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleDeletedSelect = id => {
    setSelectedDeleted(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const selectAllPending = () => {
    if (selectedPending.length === filteredPendingUsers.length) {
      setSelectedPending([]);
    } else {
      setSelectedPending(filteredPendingUsers.map(user => user._id));
    }
  };

  const selectAllActive = () => {
    if (selectedActive.length === filteredActiveUsers.length) {
      setSelectedActive([]);
    } else {
      setSelectedActive(filteredActiveUsers.map(user => user._id));
    }
  };

  const selectAllDeleted = () => {
    if (selectedDeleted.length === filteredDeletedUsers.length) {
      setSelectedDeleted([]);
    } else {
      setSelectedDeleted(filteredDeletedUsers.map(user => user._id));
    }
  };

  return (
    <div className="admin-container">
      <header className="admin-header">
        <h1>Admin Dashboard</h1>
        <div className="user-info">
          <span>Welcome, {user.name} ({user.role})</span>
          <button onClick={logout} className="logout-btn">Logout</button>
        </div>
      </header>

      {message.text && (
        <div className={`alert ${message.type}`}>
          {message.text}
          <button 
            onClick={() => setMessage({ text: '', type: '' })}
            aria-label="Close message"
            className="close-alert"
          >
            &times;
          </button>
        </div>
      )}

      <div className="admin-tabs">
        <button
          className={activeTab === 'pending' ? 'active' : ''}
          onClick={() => setActiveTab('pending')}
          disabled={isLoading.pending}
        >
          {isLoading.pending ? 'Loading...' : `Pending Approvals (${pendingUsers.length})`}
        </button>
        <button
          className={activeTab === 'active' ? 'active' : ''}
          onClick={() => setActiveTab('active')}
          disabled={isLoading.active}
        >
          {isLoading.active ? 'Loading...' : `Active Users (${activeUsers.length})`}
        </button>
        <button
          className={activeTab === 'deleted' ? 'active' : ''}
          onClick={() => setActiveTab('deleted')}
          disabled={isLoading.deleted}
        >
          {isLoading.deleted ? 'Loading...' : `Deleted Users (${deletedUsers.length})`}
        </button>
      </div>

      <div className="admin-content">
        <div className="filter-section">
          <div className="filter-row">
            <div className="filter-group">
              <label>Role</label>
              <select name="role" value={filters.role} onChange={handleFilterChange}>
                <option value="">All Roles</option>
                <option value="student">Student</option>
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            
            <div className="filter-group">
              <label>Department</label>
              <input 
                type="text" 
                name="department" 
                value={filters.department} 
                onChange={handleFilterChange}
                placeholder="Filter by department"
              />
            </div>
            
            <div className="filter-group">
              <label>Section</label>
              <input 
                type="text" 
                name="section" 
                value={filters.section} 
                onChange={handleFilterChange}
                placeholder="Filter by section"
              />
            </div>
            
            <div className="filter-group">
              <label>Batch</label>
              <input 
                type="text" 
                name="batch" 
                value={filters.batch} 
                onChange={handleFilterChange}
                placeholder="Filter by batch"
              />
            </div>
            
            <div className="filter-group">
              <label>Search</label>
              <input 
                type="text" 
                name="search" 
                value={filters.search} 
                onChange={handleFilterChange}
                placeholder="Search by name or ID"
              />
            </div>
            
            <button onClick={resetFilters} className="reset-filters">
              Reset Filters
            </button>
          </div>
        </div>

        {activeTab === 'pending' && (
          <>
            <div className="section-header">
              <h2>Pending User Approvals ({filteredPendingUsers.length})</h2>
              <div className="action-buttons">
                <button
                  onClick={handleApprove}
                  disabled={selectedPending.length === 0 || isLoading.action}
                  className="primary-btn"
                >
                  {isLoading.action ? 'Processing...' : `Approve Selected (${selectedPending.length})`}
                </button>
              </div>
            </div>
            
            {isLoading.pending ? (
              <div className="loading-spinner">Loading...</div>
            ) : filteredPendingUsers.length > 0 ? (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>
                        <input
                          type="checkbox"
                          checked={selectedPending.length === filteredPendingUsers.length && filteredPendingUsers.length > 0}
                          onChange={selectAllPending}
                          disabled={filteredPendingUsers.length === 0}
                        />
                      </th>
                      <th>Name</th>
                      <th>Roll Number</th>
                      <th>Role</th>
                      <th>Department</th>
                      <th>Section</th>
                      <th>Batch</th>
                      <th>Registered At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPendingUsers.map(user => (
                      <tr key={user._id}>
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedPending.includes(user._id)}
                            onChange={() => togglePendingSelect(user._id)}
                          />
                        </td>
                        <td>{user.name}</td>
                        <td>{user.rollNumber}</td>
                        <td>{user.role}</td>
                        <td>{user.department}</td>
                        <td>{user.section || '-'}</td>
                        <td>{user.batch || '-'}</td>
                        <td>{new Date(user.createdAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="no-data-message">
                {pendingUsers.length === 0 ? 'No pending users for approval' : 'No users match the current filters'}
              </p>
            )}
          </>
        )}

        {activeTab === 'active' && (
          <>
            <div className="section-header">
              <h2>Active Users ({filteredActiveUsers.length})</h2>
              <div className="action-buttons">
                <button
                  onClick={() => setShowCreateStaffModal(true)}
                  className="primary-btn"
                >
                  Create Staff Account
                </button>
                <button
                  onClick={handleDelete}
                  disabled={selectedActive.length === 0 || isLoading.action}
                  className="danger-btn"
                >
                  {isLoading.action ? 'Deleting...' : `Delete Selected (${selectedActive.length})`}
                </button>
              </div>
            </div>
            
            {isLoading.active ? (
              <div className="loading-spinner">Loading...</div>
            ) : filteredActiveUsers.length > 0 ? (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>
                        <input
                          type="checkbox"
                          checked={selectedActive.length === filteredActiveUsers.length && filteredActiveUsers.length > 0}
                          onChange={selectAllActive}
                          disabled={filteredActiveUsers.length === 0}
                        />
                      </th>
                      <th>Name</th>
                      <th>Roll Number</th>
                      <th>Role</th>
                      <th>Department</th>
                      <th>Section</th>
                      <th>Batch</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredActiveUsers.map(user => (
                      <tr key={user._id}>
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedActive.includes(user._id)}
                            onChange={() => toggleActiveSelect(user._id)}
                          />
                        </td>
                        <td>{user.name}</td>
                        <td>{user.rollNumber}</td>
                        <td>{user.role}</td>
                        <td>{user.department}</td>
                        <td>{user.section || '-'}</td>
                        <td>{user.batch || '-'}</td>
                        <td>
                          <button 
                            onClick={() => openPasswordModal(user._id)}
                            className="secondary-btn small-btn"
                          >
                            Update Password
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="no-data-message">
                {activeUsers.length === 0 ? 'No active users' : 'No users match the current filters'}
              </p>
            )}
          </>
        )}

        {activeTab === 'deleted' && (
          <>
            <div className="section-header">
              <h2>Deleted Users ({filteredDeletedUsers.length})</h2>
              <div className="action-buttons">
                <button
                  onClick={handleRestore}
                  disabled={selectedDeleted.length === 0 || isLoading.action}
                  className="success-btn"
                >
                  {isLoading.action ? 'Restoring...' : `Restore Selected (${selectedDeleted.length})`}
                </button>
                <button
                  onClick={handlePermanentDelete}
                  disabled={selectedDeleted.length === 0 || isLoading.action}
                  className="danger-btn"
                >
                  {isLoading.action ? 'Deleting...' : `Permanently Delete (${selectedDeleted.length})`}
                </button>
              </div>
            </div>
            
            {isLoading.deleted ? (
              <div className="loading-spinner">Loading...</div>
            ) : filteredDeletedUsers.length > 0 ? (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>
                        <input
                          type="checkbox"
                          checked={selectedDeleted.length === filteredDeletedUsers.length && filteredDeletedUsers.length > 0}
                          onChange={selectAllDeleted}
                          disabled={filteredDeletedUsers.length === 0}
                        />
                      </th>
                      <th>Name</th>
                      <th>Roll Number</th>
                      <th>Role</th>
                      <th>Department</th>
                      <th>Section</th>
                      <th>Batch</th>
                      <th>Deleted At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDeletedUsers.map(user => (
                      <tr key={user._id}>
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedDeleted.includes(user._id)}
                            onChange={() => toggleDeletedSelect(user._id)}
                          />
                        </td>
                        <td>{user.name}</td>
                        <td>{user.rollNumber}</td>
                        <td>{user.role}</td>
                        <td>{user.department}</td>
                        <td>{user.section || '-'}</td>
                        <td>{user.batch || '-'}</td>
                        <td>{new Date(user.deletedAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="no-data-message">
                {deletedUsers.length === 0 ? 'No deleted users' : 'No users match the current filters'}
              </p>
            )}
          </>
        )}
      </div>

      {/* Create Staff Modal */}
      {showCreateStaffModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Create New Staff Account</h3>
            <button 
              className="close-modal" 
              onClick={() => setShowCreateStaffModal(false)}
            >
              &times;
            </button>
            <form onSubmit={handleCreateStaff}>
              <div className="form-group">
                <label>Full Name *</label>
                <input
                  type="text"
                  value={newStaff.name}
                  onChange={(e) => setNewStaff({...newStaff, name: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>Staff ID *</label>
                <input
                  type="text"
                  value={newStaff.rollNumber}
                  onChange={(e) => setNewStaff({...newStaff, rollNumber: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>Password *</label>
                <input
                  type="password"
                  value={newStaff.password}
                  onChange={(e) => setNewStaff({...newStaff, password: e.target.value})}
                  required
                  minLength="6"
                />
              </div>
              <div className="form-group">
                <label>Department *</label>
                <input
                  type="text"
                  value={newStaff.department}
                  onChange={(e) => setNewStaff({...newStaff, department: e.target.value})}
                  required
                />
              </div>
              <div className="modal-buttons">
                <button
                  type="button"
                  onClick={() => setShowCreateStaffModal(false)}
                  className="secondary-btn"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading.action}
                  className="primary-btn"
                >
                  {isLoading.action ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Update Modal */}
      {showPasswordModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Update User Password</h3>
            <button 
              className="close-modal" 
              onClick={() => setShowPasswordModal(false)}
            >
              &times;
            </button>
            <form onSubmit={handlePasswordUpdate}>
              <div className="form-group">
                <label>New Password *</label>
                <input
                  type="password"
                  value={passwordUpdateData.newPassword}
                  onChange={(e) => setPasswordUpdateData({
                    ...passwordUpdateData,
                    newPassword: e.target.value
                  })}
                  required
                  minLength="6"
                />
              </div>
              <div className="form-group">
                <label>Confirm Password *</label>
                <input
                  type="password"
                  value={passwordUpdateData.confirmPassword}
                  onChange={(e) => setPasswordUpdateData({
                    ...passwordUpdateData,
                    confirmPassword: e.target.value
                  })}
                  required
                  minLength="6"
                />
              </div>
              <div className="modal-buttons">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="secondary-btn"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading.action}
                  className="primary-btn"
                >
                  {isLoading.action ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;