'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

export type User = {
  id: string; // auth.users.id
  name: string; // display_name ?? parte local del email ?? 'PLAYER1'
};

type UserContextValue = {
  user: User | null;
  signOut: () => Promise<void>;
};

const UserContext = createContext<UserContextValue | null>(null);

// Deriva el User de la app a partir del usuario de Supabase Auth.
function toUser(sUser: SupabaseUser | null | undefined): User | null {
  if (!sUser) return null;
  const displayName = (sUser.user_metadata?.display_name as string) || '';
  const name = displayName || sUser.email?.split('@')[0] || 'PLAYER1';
  return { id: sUser.id, name: name.toUpperCase().slice(0, 10) };
}

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getUser().then(({ data }) => {
      if (mounted) setUser(toUser(data.user));
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(toUser(session?.user ?? null));
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
  }

  return (
    <UserContext.Provider value={{ user, signOut }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used inside UserProvider');
  return ctx;
}
