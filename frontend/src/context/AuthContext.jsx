import { createContext, useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";

const AuthContext = createContext(null);

function normalizeToken(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() =>
    normalizeToken(localStorage.getItem("token")),
  );
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem("user");
    return storedUser ? JSON.parse(storedUser) : null;
  });

  useEffect(() => {
    if (token) axios.defaults.headers.common.Authorization = `Bearer ${token}`;
    else delete axios.defaults.headers.common.Authorization;
  }, [token]);

  const login = (data) => {
    const nextToken = normalizeToken(data?.token);
    if (!nextToken) {
      logout();
      return;
    }

    localStorage.setItem("token", nextToken);
    localStorage.setItem("user", JSON.stringify(data.user));
    setToken(nextToken);
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
  };

  const value = useMemo(() => ({ token, user, login, logout }), [token, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
