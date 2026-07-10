import { api } from "./api";

export const aiService = {
  generateTemplate: (payload) => api.post("/ai/generate-template", payload)
};
