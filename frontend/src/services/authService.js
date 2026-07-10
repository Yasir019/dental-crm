import { api } from "./api";

export const authService = {
  login: (payload) => api.post("/auth/login", payload),
  me: () => api.get("/auth/me"),
  updateProfile: (payload) => api.patch("/auth/profile", payload),
  updatePassword: (payload) => api.patch("/auth/password", payload)
};
