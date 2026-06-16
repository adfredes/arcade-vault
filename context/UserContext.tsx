'use client';

import { createContext, startTransition, useContext, useEffect, useState } from 'react';

export type User = { name: string };

type UserContextValue = {
  user: User | null;
  login: (u: User) => void;
  signOut: () => void;
};

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('av_user');
      if (raw) startTransition(() => setUser(JSON.parse(raw)));
    } catch {
      // corrupted storage — ignore
    }
  }, []);

  function login(u: User) {
    setUser(u);
    localStorage.setItem('av_user', JSON.stringify(u));
  }

  function signOut() {
    setUser(null);
    localStorage.removeItem('av_user');
  }

  return (
    <UserContext.Provider value={{ user, login, signOut }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used inside UserProvider');
  return ctx;
}
