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
  async fetchGamesFromApi(date: string, sport: string, league: string) {
    return this.request('/api/admin/games/fetch', {
      method: 'POST',
      body: JSON.stringify({ date, sport, league }),
    });
  }

  async getSupportedSports() {
    return this.request('/api/admin/sports');
  }

  async getGameRoster(gameId: string) {
    return this.request(`/api/admin/teams/${gameId}/roster`);
  }

  async createBet(gameId: string, betType: string, config: any) {
    return this.request('/api/admin/bets', {
      method: 'POST',
      body: JSON.stringify({
        game_id: gameId,
        bet_type: betType,
        config
      }),
    });
  }

  async updateBet(betId: string, updates: { bet_type?: string; config?: any; display_text_override?: string; priority?: number }) {
    return this.request(`/api/admin/bets/${betId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async deleteBet(betId: string) {
    return this.request(`/api/admin/bets/${betId}`, {
      method: 'DELETE',
    });
  }

  async reorderBets(gameId: string, betIds: string[]) {
    return this.request(`/api/admin/games/${gameId}/bets/reorder`, {
      method: 'PUT',
      body: JSON.stringify({ bet_ids: betIds }),
    });
  }
}

export const api = new ApiService();

