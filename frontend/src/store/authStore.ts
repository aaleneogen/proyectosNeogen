import { create } from "zustand";
import { persist } from "zustand/middleware";
import { User } from "@/lib/api";

interface AuthState {
  user: User | null;
  token: string | null;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
  isAdmin: () => boolean;
  isEleco: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      setAuth: (user, token) => {
        localStorage.setItem("access_token", token);
        set({ user, token });
      },
      logout: () => {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user");
        set({ user: null, token: null });
      },
      isAdmin: () => get().user?.role === "admin_neogen",
      isEleco: () => get().user?.role === "eleco",
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({ user: state.user, token: state.token }),
    }
  )
);
