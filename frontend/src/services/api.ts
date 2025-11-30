import type { ApiResponse } from '../interfaces';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

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
        const error: any = new Error(data.error?.message || 'Request failed');
        error.code = data.error?.code;
        throw error;
      }
      
      return data;
    } catch (error: any) {
      // Preserve error code if it exists, or if this is a network error, create a new one
      if (error.code) {
        const newError: any = new Error(error.message || 'Network error');
        newError.code = error.code;
        throw newError;
      }
      // If it's not our custom error, it might be a network error - create a generic one
      const networkError: any = new Error(error.message || 'Network error');
      throw networkError;
    }
  }

  // Auth endpoints
  async register(username: string, email: string, password: string): Promise<ApiResponse<{ user: any }>> {
    return this.request<{ user: any }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    });
  }

  async login(email: string, password: string): Promise<ApiResponse<{ user: any }>> {
    return this.request<{ user: any }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async logout(): Promise<ApiResponse> {
    return this.request('/api/auth/logout', {
      method: 'POST',
    });
  }

  async getCurrentUser(): Promise<ApiResponse<{ user: any }>> {
    return this.request<{ user: any }>('/api/auth/me');
  }

  async requestMagicLink(email: string, username?: string) {
    return this.request('/api/auth/magic-link/request', {
      method: 'POST',
      body: JSON.stringify({ email, ...(username && { username }) }),
    });
  }

  async verifyMagicLink(token: string) {
    return this.request(`/api/auth/magic-link/verify?token=${token}`);
  }

  async resendVerificationEmail() {
    return this.request('/api/auth/verify-email/resend', {
      method: 'POST',
    });
  }

  async verifyEmail(token: string) {
    return this.request(`/api/auth/verify-email?token=${token}`);
  }

  async forgotPassword(email: string) {
    return this.request('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async resetPassword(token: string, password: string, confirmPassword: string) {
    return this.request('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password, confirmPassword }),
    });
  }

  async updateUsername(username: string) {
    return this.request<{ user: any }>('/api/auth/profile/username', {
      method: 'PATCH',
      body: JSON.stringify({ username }),
    });
  }

  async updateEmail(email: string) {
    return this.request<{ user: any }>('/api/auth/profile/email', {
      method: 'PATCH',
      body: JSON.stringify({ email }),
    });
  }

  async updatePassword(currentPassword: string, newPassword: string, confirmPassword: string) {
    return this.request('/api/auth/profile/password', {
      method: 'PATCH',
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
    });
  }

  // Admin endpoints
  async fetchGamesFromApi(
    date: string, 
    sport: string, 
    league: string, 
    force: boolean = false,
    timezoneOffset?: number
  ) {
    return this.request('/api/admin/games/fetch', {
      method: 'POST',
      body: JSON.stringify({ date, sport, league, force, timezoneOffset }),
    });
  }

  async getSupportedSports() {
    return this.request('/api/admin/sports');
  }

  // Public bets endpoint
  async getTodaysBets(date: string, timezoneOffset: number): Promise<ApiResponse<{ games: any[] }>> {
    return this.request<{ games: any[] }>(`/api/bets/today?date=${date}&timezoneOffset=${timezoneOffset}`);
  }

  // Bet selection endpoints
  async selectBet(betId: string, selectedSide: string) {
    return this.request(`/api/bets/${betId}/select`, {
      method: 'POST',
      body: JSON.stringify({ selectedSide }),
    });
  }

  async getMySelections(date?: string, timezoneOffset?: number) {
    const params = new URLSearchParams();
    if (date) {
      params.append('date', date);
    }
    if (timezoneOffset !== undefined) {
      params.append('timezoneOffset', timezoneOffset.toString());
    }
    const queryString = params.toString();
    return this.request(`/api/bets/my-selections${queryString ? `?${queryString}` : ''}`);
  }

  async deleteSelection(selectionId: string) {
    return this.request(`/api/bets/selections/${selectionId}`, {
      method: 'DELETE',
    });
  }

  async getGameRoster(gameId: string) {
    return this.request(`/api/admin/teams/${gameId}/roster`);
  }

  async createBet(gameId: string, betType: string, config: any, displayTextOverride?: string) {
    return this.request('/api/admin/bets', {
      method: 'POST',
      body: JSON.stringify({
        game_id: gameId,
        bet_type: betType,
        config,
        display_text_override: displayTextOverride || undefined
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

  async resolveBet(betId: string) {
    return this.request(`/api/admin/bets/${betId}/resolve`, {
      method: 'POST',
    });
  }

  // Parlay endpoints
  async startParlay(betId: string, selectedSide: string, existingSelectionId?: string) {
    return this.request('/api/parlays/start', {
      method: 'POST',
      body: JSON.stringify({ betId, selectedSide, existingSelectionId }),
    });
  }

  async addSelectionToParlay(parlayId: string, betId: string, selectedSide: string, existingSelectionId?: string) {
    return this.request(`/api/parlays/${parlayId}/add-selection`, {
      method: 'POST',
      body: JSON.stringify({ betId, selectedSide, existingSelectionId }),
    });
  }

  async removeSelectionFromParlay(parlayId: string, selectionId: string) {
    return this.request(`/api/parlays/${parlayId}/selections/${selectionId}`, {
      method: 'DELETE',
    });
  }

  async getParlays(status?: string, includeSelections: boolean = true, date?: string, timezoneOffset?: number) {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (!includeSelections) params.append('includeSelections', 'false');
    if (date) params.append('date', date);
    if (timezoneOffset !== undefined) params.append('timezoneOffset', timezoneOffset.toString());
    const query = params.toString();
    return this.request(`/api/parlays${query ? `?${query}` : ''}`);
  }

  async getParlay(parlayId: string): Promise<ApiResponse<{ parlay: any }>> {
    return this.request<{ parlay: any }>(`/api/parlays/${parlayId}`);
  }

  async updateParlay(parlayId: string, updates: { insured?: boolean }): Promise<ApiResponse<{ parlay: any }>> {
    return this.request<{ parlay: any }>(`/api/parlays/${parlayId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async deleteParlay(parlayId: string) {
    return this.request(`/api/parlays/${parlayId}`, {
      method: 'DELETE',
    });
  }
}

export const api = new ApiService();

