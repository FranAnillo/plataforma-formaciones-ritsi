const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPut = jest.fn();
const mockDelete = jest.fn();
const mockCreate = jest.fn(() => ({ get: mockGet, post: mockPost, put: mockPut, delete: mockDelete }));

jest.mock('axios', () => ({
  __esModule: true,
  default: { create: mockCreate },
  create: mockCreate,
}));

describe('api service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreate.mockImplementation(() => ({
      get: mockGet,
      post: mockPost,
      put: mockPut,
      delete: mockDelete,
    }));
  });

  it('normalizes the backend URL and delegates every HTTP method', async () => {
    process.env.REACT_APP_BACKEND_URL = 'http://localhost:8000/';
    jest.isolateModules(() => {
      const { BACKEND_URL, api, fetchAllData } = require('./api');
      expect(BACKEND_URL).toBe('http://localhost:8000');
      expect(mockCreate).toHaveBeenCalledWith({
        baseURL: 'http://localhost:8000/api',
        withCredentials: true,
      });

      api.get('/one', { params: { q: 1 } });
      api.post('/two', { a: 1 }, { headers: { x: 1 } });
      api.put('/three', { b: 2 }, {});
      api.delete('/four', {});
      expect(mockGet).toHaveBeenCalledWith('/one', { params: { q: 1 } });
      expect(mockPost).toHaveBeenCalledWith('/two', { a: 1 }, { headers: { x: 1 } });
      expect(mockPut).toHaveBeenCalledWith('/three', { b: 2 }, {});
      expect(mockDelete).toHaveBeenCalledWith('/four', {});

      mockGet.mockResolvedValueOnce({ data: 1 }).mockResolvedValueOnce({ data: 2 });
      return expect(fetchAllData(['/a', '/b'])).resolves.toEqual([{ data: 1 }, { data: 2 }]);
    });
  });

  it('falls back to same-origin /api when no backend URL is configured', () => {
    process.env.REACT_APP_BACKEND_URL = '';
    jest.isolateModules(() => {
      require('./api');
      expect(mockCreate).toHaveBeenLastCalledWith({
        baseURL: '/api',
        withCredentials: true,
      });
    });
  });
});
