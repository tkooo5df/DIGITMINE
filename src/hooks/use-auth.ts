import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface AuthState {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  loading: boolean;
}

const adminStatusCache = new Map<string, Promise<boolean>>();

async function checkAdmin(userId: string) {
  const cached = adminStatusCache.get(userId);
  if (cached) return cached;

  const request = Promise.resolve(
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle()
  ).then(({ data }) => Boolean(data));

  adminStatusCache.set(userId, request);
  return request;
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    isAdmin: false,
    loading: true,
  });

  useEffect(() => {
    let active = true;

    // Listener FIRST to catch all events
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setState((s) => ({ ...s, session, user: session?.user ?? null }));

      if (session?.user) {
        // Defer with setTimeout to avoid deadlocks
        setTimeout(async () => {
          const isAdmin = await checkAdmin(session.user.id);
          if (active) setState({ user: session.user, session, isAdmin, loading: false });
        }, 0);
      } else {
        setState({ user: null, session: null, isAdmin: false, loading: false });
      }
    });

    // Then read existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!active) return;
      if (session?.user) {
        const isAdmin = await checkAdmin(session.user.id);
        if (active) setState({ user: session.user, session, isAdmin, loading: false });
      } else {
        setState({ user: null, session: null, isAdmin: false, loading: false });
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}
