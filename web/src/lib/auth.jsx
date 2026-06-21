// Authentication context: holds the current user, exposes login/register/logout,
// and persists tokens via the api tokenStore.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, tokenStore } from "./api";

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    if (!tokenStore.access()) {
      setUser(null);
      return;
    }
    try {
      const me = await api.get("/v1/users/me");
      setUser(me);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refreshUser().finally(() => setLoading(false));
  }, [refreshUser]);

  const login = useCallback(async (email, password) => {
    const res = await api.post("/v1/auth/login", { email, password });
    tokenStore.set(res.access_token, res.refresh_token);
    setUser(res.user);
  }, []);

  const register = useCallback(
    async (email, password, fullName, phone) => {
      await api.post("/v1/auth/register", { email, password, full_name: fullName, phone });
      await login(email, password);
    },
    [login],
  );

  const logout = useCallback(() => {
    const refresh = tokenStore.refresh();
    if (refresh) api.post("/v1/auth/logout", { refresh_token: refresh }).catch(() => {});
    tokenStore.clear();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refreshUser }),
    [user, loading, login, register, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
