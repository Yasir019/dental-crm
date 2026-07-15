const isLocalHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (isLocalHost ? "http://localhost:5000/api" : "https://dental-crm-neg8.onrender.com/api");

async function request(path, options = {}) {
  const token = localStorage.getItem("dentalLeadAuthToken");
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    },
    ...options
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const detail = data.detail && typeof data.detail === "object" ? data.detail : {};
    const error = new Error(data.message || detail.message || "Request failed.");
    error.errors = data.errors || detail.errors;
    error.availableSlots = data.availableSlots || detail.availableSlots || [];
    error.retellError = data.retellError || detail.retellError;
    throw error;
  }

  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: "POST", body: JSON.stringify(body) }),
  patch: (path, body) => request(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: (path) => request(path, { method: "DELETE" })
};
