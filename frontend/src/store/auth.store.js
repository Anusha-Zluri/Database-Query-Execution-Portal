import { create } from "zustand";
import { login as loginApi, getMe } from "../api/auth.api";

export const useAuthStore = create((set) => ({
  user: null,
  token: localStorage.getItem("token"),
  loading: false,

  login: async (email, password) => {
    set({ loading: true });

    try {
      const { token } = await loginApi(email, password);
      localStorage.setItem("token", token);

      const user = await getMe();

      set({ user, token, loading: false });
      return true;
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },

  logout: () => {
    localStorage.removeItem("token");
    set({ user: null, token: null });
  },
}));