import { create } from "zustand";
import { login as loginApi, getMe, logout as logoutApi } from "../api/auth.api";

export const useAuthStore = create((set) => ({
  user: null,
  token: localStorage.getItem("token"),
  loading: false,

  login: async (email, password) => {
    set({ loading: true });

    try {
      const { token } = await loginApi(email, password); //api call
      localStorage.setItem("token", token);

      const user = await getMe();

      set({ user, token, loading: false });
      return true;
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },

  logout: async () => {
    try {
      // Call backend logout API first
      await logoutApi();
    } catch (err) {
      console.error('Logout API failed:', err);
      // Continue with local logout even if API fails
    }
    
    // Always clear local state
    localStorage.removeItem("token");
    set({ user: null, token: null });
  },
}));