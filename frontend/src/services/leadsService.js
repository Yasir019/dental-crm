import { api } from "./api";

export const leadsService = {
  createLead: (payload) => api.post("/leads/create", payload),
  getLeads: () => api.get("/leads"),
  getLead: (id) => api.get(`/leads/${id}`),
  getArchivedLeads: () => api.get("/leads/archived"),
  getVoiceCall: (id, { callType, callId } = {}) => {
    const params = new URLSearchParams();
    if (callType) params.set("callType", callType);
    if (callId) params.set("callId", callId);
    const query = params.toString();
    return api.get(`/leads/${id}/voice-call${query ? `?${query}` : ""}`);
  },
  updateLead: (id, payload) => api.patch(`/leads/${id}`, payload),
  archiveLead: (id) => api.patch("/leads/archive", { id, archived: true }),
  restoreLead: (id) => api.patch("/leads/archive", { id, archived: false }),
  deleteLead: (id) => api.delete(`/leads/${id}`),
  updateStatus: (id, status) => api.patch("/leads/status", { id, status }),
  updateFollowup: (id, followup) => api.patch("/leads/followup", { id, followup })
};
