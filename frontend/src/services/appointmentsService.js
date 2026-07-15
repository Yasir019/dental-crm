import { api } from "./api";

export const appointmentsService = {
  getAppointments: ({ start, end } = {}) => {
    const query = new URLSearchParams();
    if (start) query.set("start", start);
    if (end) query.set("end", end);
    return api.get(`/appointments${query.toString() ? `?${query}` : ""}`);
  },
  createAppointment: (payload) => api.post("/appointments", payload),
  updateAppointment: (appointmentId, payload) => api.patch(`/appointments/${appointmentId}`, payload)
};
