import { api } from "./api";

export const chatbotService = {
  sendMessage: (payload) => api.post("/chatbot/message", payload)
};
