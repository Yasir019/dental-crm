import { api } from "./api";

export const voiceService = {
  createWebCall: () => api.post("/voice/web-call", {})
};
