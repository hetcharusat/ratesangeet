import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { saveAuth, getAuth, clearAuth, AuthState, User } from '../utils/auth';

interface AuthContextType extends AuthState {
  setAuth: (authData: AuthState) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    accessToken: null,
    refreshToken: null,
    user: null,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAuth();
  }, []);

  const loadAuth = async () => {
    const auth = await getAuth();
    setAuthState(auth);
    setIsLoading(false);
  };

  const setAuth = async (authData: AuthState) => {
    setAuthState(authData);
    await saveAuth(authData);
  };

  const logout = async () => {
    await clearAuth();
    setAuthState({ accessToken: null, refreshToken: null, user: null });
  };

  return (
    <AuthContext.Provider value={{ ...authState, setAuth, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
