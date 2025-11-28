/**
 * Context-related interfaces for the frontend
 */

import { User } from './user';
import { Parlay } from './parlay';

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export interface ParlayContextType {
  activeParlay: Parlay | null;
  setActiveParlay: (parlay: Parlay | null) => void;
  refreshActiveParlay: () => Promise<void>;
  isParlayBuilderOpen: boolean;
  setIsParlayBuilderOpen: (open: boolean) => void;
}

export interface BetsContextType {
  refreshTrigger: number;
  triggerRefresh: () => void;
  selectedDate: string | null;
  setSelectedDate: (date: string | null) => void;
}

