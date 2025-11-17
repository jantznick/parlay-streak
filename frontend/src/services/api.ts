const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
  };
}

class ApiService {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${API_URL}${endpoint}`;
    
    const config: RequestInit = {
      ...options,
      credentials: 'include', // Important for session cookies
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error?.message || 'Request failed');
      }
      
      return data;
    } catch (error: any) {
      throw new Error(error.message || 'Network error');
    }
  }

  // Auth endpoints
  async register(username: string, email: string, password: string) {
    return this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    });
  }

  async login(email: string, password: string) {
    return this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async logout() {
    return this.request('/api/auth/logout', {
      method: 'POST',
    });
  }

  async getCurrentUser() {
    return this.request('/api/auth/me');
  }

  async requestMagicLink(email: string) {
    return this.request('/api/auth/magic-link/request', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async verifyMagicLink(token: string) {
    return this.request(`/api/auth/magic-link/verify?token=${token}`);
  }

  // Admin endpoints
  async fetchGamesFromApi(date: string) {
    return this.request('/api/admin/games/fetch', {
      method: 'POST',
      body: JSON.stringify({ date }),
    });
  }

  async getGames(date: string, sport?: string) {
    const params = new URLSearchParams({ date });
    if (sport) params.append('sport', sport);
    return this.request(`/api/admin/games?${params.toString()}`);
  }

  async getSupportedSports() {
    return this.request('/api/admin/sports');
  }
}

export const api = new ApiService();

