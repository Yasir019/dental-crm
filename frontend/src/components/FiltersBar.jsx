import { LEAD_SOURCES, SERVICES, STATUSES } from "../utils/constants";

export default function FiltersBar({ filters, setFilters }) {
  function update(field, value) {
    setFilters((current) => ({ ...current, [field]: value }));
  }

  return (
    <div className="grid gap-3 rounded-lg border border-emerald-100 bg-white p-4 shadow-soft md:grid-cols-6">
      <input className="form-input md:col-span-2" placeholder="Search name, phone, email, service" value={filters.search} onChange={(event) => update("search", event.target.value)} />
      <input className="form-input" type="date" value={filters.startDate} onChange={(event) => update("startDate", event.target.value)} />
      <input className="form-input" type="date" value={filters.endDate} onChange={(event) => update("endDate", event.target.value)} />
      <select className="form-input" value={filters.service} onChange={(event) => update("service", event.target.value)}>
        <option value="">All services</option>
        {SERVICES.map((service) => (
          <option key={service} value={service}>
            {service}
          </option>
        ))}
      </select>
      <select className="form-input md:col-span-1" value={filters.status} onChange={(event) => update("status", event.target.value)}>
        <option value="">All statuses</option>
        {STATUSES.map((status) => (
          <option key={status} value={status}>
            {status}
          </option>
        ))}
      </select>
      <select className="form-input md:col-span-1" value={filters.source} onChange={(event) => update("source", event.target.value)}>
        <option value="">All sources</option>
        {LEAD_SOURCES.map((source) => (
          <option key={source} value={source}>
            {source}
          </option>
        ))}
      </select>
    </div>
  );
}
