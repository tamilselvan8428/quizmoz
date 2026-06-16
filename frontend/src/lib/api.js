const API_URL = import.meta.env.VITE_API_URL || '/api';

const getHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
};

export const api = {
  auth: {
    login: async (rollNo, password) => {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rollNo, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      localStorage.setItem('token', data.token);
      localStorage.setItem('current_user', JSON.stringify(data.user));
      return data;
    },
    register: async (userData) => {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');
      return data;
    },
    logout: () => {
      localStorage.removeItem('token');
      localStorage.removeItem('current_user');
    },
  },
  users: {
    getAll: async () => {
      const res = await fetch(`${API_URL}/users`, { headers: getHeaders() });
      return res.json();
    },
    delete: async (id) => {
      const res = await fetch(`${API_URL}/users/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      return res.json();
    },
    updatePassword: async (id, password) => {
      const res = await fetch(`${API_URL}/users/${id}/password`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update failed');
      return data;
    },
    updateProfile: async (profileData) => {
      const res = await fetch(`${API_URL}/users/profile`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(profileData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Profile update failed');
      return data;
    },
  },
  quizzes: {
    getAll: async () => {
      const res = await fetch(`${API_URL}/quizzes`, { headers: getHeaders() });
      return res.json();
    },
    save: async (quiz) => {
      const method = quiz._id ? 'PUT' : 'POST';
      const url = quiz._id ? `${API_URL}/quizzes/${quiz._id}` : `${API_URL}/quizzes`;
      const res = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify(quiz),
      });
      return res.json();
    },
    delete: async (id) => {
      const res = await fetch(`${API_URL}/quizzes/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      return res.json();
    },
  },
  results: {
    getAll: async () => {
      const res = await fetch(`${API_URL}/results`, { headers: getHeaders() });
      return res.json();
    },
    save: async (result) => {
      const res = await fetch(`${API_URL}/results`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(result),
      });
      return res.json();
    },
    update: async (result) => {
      const res = await fetch(`${API_URL}/results/${result._id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(result),
      });
      return res.json();
    },
  },
  learning: {
    getAll: async (studentId) => {
      const res = await fetch(`${API_URL}/learning?studentId=${studentId}`, { headers: getHeaders() });
      return res.json();
    },
    save: async (session) => {
      const method = session._id ? 'PUT' : 'POST';
      const url = session._id ? `${API_URL}/learning/${session._id}` : `${API_URL}/learning`;
      const res = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify(session),
      });
      return res.json();
    },
    delete: async (id) => {
      const res = await fetch(`${API_URL}/learning/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      return res.json();
    },
  },
};
