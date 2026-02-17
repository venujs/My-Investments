import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { User } from 'shared';
import { authApi } from '@/api/auth';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  needsSetup: boolean;
  login: (userId: number, pin: string) => Promise<User>;
  logout: () => Promise<void>;
  setup: (name: string, pin: string) => Promise<User>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);

  const checkAuth = useCallback(async () => {
    try {
      const me = await authApi.me();
      setUser(me);
      setNeedsSetup(false);
    } catch {
      setUser(null);
      try {
        const users = await authApi.getUsers();
        setNeedsSetup(users.length === 0);
      } catch {
        setNeedsSetup(false);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { checkAuth(); }, [checkAuth]);

  const login = async (userId: number, pin: string): Promise<User> => {
    const loggedInUser = await authApi.login(userId, pin);
    setUser(loggedInUser);
    return loggedInUser;
  };

  const logout = async () => {
    await authApi.logout();
    setUser(null);
  };

  const setup = async (name: string, pin: string): Promise<User> => {
    const newUser = await authApi.setup({ name, pin });
    setUser(newUser);
    setNeedsSetup(false);
    return newUser;
  };

  const refreshUser = async () => {
    await checkAuth();
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, needsSetup, login, logout, setup, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
