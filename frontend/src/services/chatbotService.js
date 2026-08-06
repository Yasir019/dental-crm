import { api } from "./api";

export const chatbotService = {
  sendMessage: (payload) => api.post("/chatbot/message", payload),
  bookAppointment: (payload) => api.post("/chatbot/appointment", payload)
};
