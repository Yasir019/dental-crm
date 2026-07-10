import { api } from "./api";

export const emailService = {
  sendEmail: (payload) => api.post("/email/send", payload)
};
