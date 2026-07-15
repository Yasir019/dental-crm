import { api } from "./api";

export const followupService = {
  getSettings: () => api.get("/followups/settings"),
  updateSettings: (payload) => api.patch("/followups/settings", payload),
  getActivities: (leadId) => api.get(`/followups/leads/${leadId}/activities`),
  sendEmail: (leadId, payload) => api.post(`/followups/leads/${leadId}/email`, payload),
  startCallback: (leadId) => api.post(`/followups/leads/${leadId}/callback`, {})
};
