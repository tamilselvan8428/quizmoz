const STORAGE_KEYS = {
  USERS: 'quiz_app_users',
  QUIZZES: 'quiz_app_quizzes',
  RESULTS: 'quiz_app_results',
  LEARNING_SESSIONS: 'quiz_app_learning_sessions',
};

// Initial Admin User
const DEFAULT_ADMIN = {
  id: 'admin-1',
  name: 'Main Admin',
  rollNo: 'admin',
  password: 'admin',
  role: 'ADMIN',
  department: 'Administration',
};

export const db = {
  getUsers: () => {
    const data = localStorage.getItem(STORAGE_KEYS.USERS);
    const users = data ? JSON.parse(data) : [];
    if (users.length === 0) {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify([DEFAULT_ADMIN]));
      return [DEFAULT_ADMIN];
    }
    return users;
  },

  saveUser: (user) => {
    const users = db.getUsers();
    const index = users.findIndex(u => u.id === user.id);
    if (index >= 0) {
      users[index] = user;
    } else {
      users.push(user);
    }
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  },

  deleteUser: (id) => {
    const users = db.getUsers().filter(u => u.id !== id);
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  },

  getQuizzes: () => {
    const data = localStorage.getItem(STORAGE_KEYS.QUIZZES);
    return data ? JSON.parse(data) : [];
  },

  saveQuiz: (quiz) => {
    const quizzes = db.getQuizzes();
    const index = quizzes.findIndex(q => q.id === quiz.id);
    if (index >= 0) {
      quizzes[index] = quiz;
    } else {
      quizzes.push(quiz);
    }
    localStorage.setItem(STORAGE_KEYS.QUIZZES, JSON.stringify(quizzes));
  },

  deleteQuiz: (id) => {
    const quizzes = db.getQuizzes().filter(q => q.id !== id);
    localStorage.setItem(STORAGE_KEYS.QUIZZES, JSON.stringify(quizzes));
  },

  getResults: () => {
    const data = localStorage.getItem(STORAGE_KEYS.RESULTS);
    return data ? JSON.parse(data) : [];
  },

  saveResult: (result) => {
    const results = db.getResults();
    results.push(result);
    localStorage.setItem(STORAGE_KEYS.RESULTS, JSON.stringify(results));
  },

  updateResult: (result) => {
    const results = db.getResults();
    const index = results.findIndex(r => r.id === result.id);
    if (index >= 0) {
      results[index] = result;
      localStorage.setItem(STORAGE_KEYS.RESULTS, JSON.stringify(results));
    }
  },

  getLearningSessions: (studentId) => {
    const data = localStorage.getItem(STORAGE_KEYS.LEARNING_SESSIONS);
    const sessions = data ? JSON.parse(data) : [];
    return sessions.filter(s => s.studentId === studentId).sort((a, b) => 
      new Date(b.lastUpdatedAt).getTime() - new Date(a.lastUpdatedAt).getTime()
    );
  },

  saveLearningSession: (session) => {
    const data = localStorage.getItem(STORAGE_KEYS.LEARNING_SESSIONS);
    let sessions = data ? JSON.parse(data) : [];
    const index = sessions.findIndex(s => s.id === session.id);
    if (index >= 0) {
      sessions[index] = session;
    } else {
      sessions.push(session);
    }
    localStorage.setItem(STORAGE_KEYS.LEARNING_SESSIONS, JSON.stringify(sessions));
  },

  deleteLearningSession: (id) => {
    const data = localStorage.getItem(STORAGE_KEYS.LEARNING_SESSIONS);
    let sessions = data ? JSON.parse(data) : [];
    sessions = sessions.filter(s => s.id !== id);
    localStorage.setItem(STORAGE_KEYS.LEARNING_SESSIONS, JSON.stringify(sessions));
  }
};
