import { api } from "./api";

export const voiceService = {
  createWebCall: (payload = {}) => api.post("/voice/web-call", payload)
};
