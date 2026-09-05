import React, { createContext, useContext, useReducer, useEffect } from 'react';
import * as authApi from '../api/auth';
import { setAccessToken } from '../api/client';

const AuthContext = createContext(null);

const initialState = {
  user: null,
  isAuthenticated: false,
  isLoading: true
};

const authReducer = (state, action) => {
  switch (action.type) {
    case 'AUTH_SUCCESS':
      return {
        ...state,
        user: action.payload,
        isAuthenticated: true,
        isLoading: false
      };
    case 'AUTH_FAILURE':
    case 'LOGOUT':
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        isLoading: false
      };
    case 'UPDATE_USER':
      return {
        ...state,
        user: { ...state.user, ...action.payload }
      };
    default:
      return state;
  }
};

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Initialize session on mount
  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      try {
        const refreshData = await authApi.refreshSession();
        if (refreshData?.accessToken) {
          const user = await authApi.getMe();
          if (isMounted) {
            dispatch({ type: 'AUTH_SUCCESS', payload: user });
          }
        }
      } catch {
        if (isMounted) {
          dispatch({ type: 'AUTH_FAILURE' });
        }
      }
    };

    initAuth();

    const handleAuthExpired = () => {
      dispatch({ type: 'AUTH_FAILURE' });
    };

    window.addEventListener('auth:expired', handleAuthExpired);
    return () => {
      isMounted = false;
      window.removeEventListener('auth:expired', handleAuthExpired);
    };
  }, []);

  const login = async (email, password) => {
    const data = await authApi.login(email, password);
    dispatch({ type: 'AUTH_SUCCESS', payload: data.user });
    return data;
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } finally {
      setAccessToken(null);
      dispatch({ type: 'LOGOUT' });
    }
  };

  const updateUserState = (updatedFields) => {
    dispatch({ type: 'UPDATE_USER', payload: updatedFields });
  };

  const hasRole = (minimumRole) => {
    if (!state.user) return false;
    const hierarchy = {
      viewer: 10,
      operator: 20,
      security_analyst: 30,
      org_admin: 40,
      super_admin: 50
    };
    const userWeight = hierarchy[state.user.role] || 0;
    const requiredWeight = hierarchy[minimumRole] || 0;
    return userWeight >= requiredWeight;
  };

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        logout,
        updateUserState,
        hasRole
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
