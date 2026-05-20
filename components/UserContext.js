import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const { user } = useAuth();
  const [dbUser, setDbUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://192.168.0.102:5000';

  const fetchUser = async () => {
    if (!user?.id) {
      setDbUser(null);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${backendUrl}/user/${user.id}`);
      const data = await response.json();
      if (data?.user) {
        setDbUser(data.user);
      }
    } catch (err) {
      console.log("[UserProvider] Error fetching user:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, [user?.id]);

  return (
    <UserContext.Provider value={{ dbUser, setDbUser, loading, refetch: fetchUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useDbUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useDbUser must be used within a UserProvider');
  }
  return context;
}