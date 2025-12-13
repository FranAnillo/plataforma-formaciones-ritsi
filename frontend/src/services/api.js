import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

axios.defaults.withCredentials = true;

/**
 * Authentication Service
 */
export const authService = {
  /**
   * Get current user session
   */
  async getMe() {
    const response = await axios.get(`${API}/auth/me`);
    return response.data;
  },

  /**
   * Process session ID from OAuth redirect
   */
  async processSession(sessionId) {
    const response = await axios.get(`${API}/auth/session?session_id=${sessionId}`);
    return response.data;
  },

  /**
   * Register new user
   */
  async register(data) {
    const response = await axios.post(`${API}/auth/register`, data);
    return response.data;
  },

  /**
   * Logout current user
   */
  async logout() {
    const response = await axios.post(`${API}/auth/logout`);
    return response.data;
  }
};

/**
 * Content Service
 */
export const contentService = {
  /**
   * Get all contents
   */
  async getAll() {
    const response = await axios.get(`${API}/content`);
    return response.data;
  },

  /**
   * Get content by ID
   */
  async getById(contentId) {
    const response = await axios.get(`${API}/content/${contentId}`);
    return response.data;
  },

  /**
   * Create new content
   */
  async create(data) {
    const response = await axios.post(`${API}/content`, data);
    return response.data;
  },

  /**
   * Delete content
   */
  async delete(contentId) {
    const response = await axios.delete(`${API}/content/${contentId}`);
    return response.data;
  }
};

/**
 * Progress Service
 */
export const progressService = {
  /**
   * Get user progress
   */
  async getAll() {
    const response = await axios.get(`${API}/progress`);
    return response.data;
  },

  /**
   * Mark file as completed
   */
  async markFileCompleted(contentId, fileId) {
    const response = await axios.post(`${API}/progress/file-completed`, {
      content_id: contentId,
      file_id: fileId
    });
    return response.data;
  },

  /**
   * Submit quiz
   */
  async submitQuiz(contentId, quizId, answers) {
    const response = await axios.post(`${API}/progress/submit-quiz`, {
      content_id: contentId,
      quiz_id: quizId,
      answers
    });
    return response.data;
  }
};

/**
 * University Service
 */
export const universityService = {
  /**
   * Get all universities
   */
  async getAll() {
    const response = await axios.get(`${API}/universities`);
    return response.data;
  }
};

/**
 * Representative Service
 */
export const representativeService = {
  /**
   * Get all representatives
   */
  async getAll() {
    const response = await axios.get(`${API}/representatives`);
    return response.data;
  }
};

/**
 * Assignment Service
 */
export const assignmentService = {
  /**
   * Create new assignment
   */
  async create(data) {
    const response = await axios.post(`${API}/assignments`, data);
    return response.data;
  }
};

/**
 * Export API base URL for components that need it
 */
export { API, BACKEND_URL };
