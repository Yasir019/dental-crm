import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Plus, UserRound, X } from "lucide-react";
import EmptyState from "../components/EmptyState";
import { appointmentsService } from "../services/appointmentsService";

const TIMEZONE = "Asia/Karachi";
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const STATUS_STYLES = {
  Scheduled: "bg-emerald-50 text-emerald-700",
  Completed: "bg-blue-50 text-blue-700",
  Cancelled: "bg-red-50 text-red-700",
  "No Show": "bg-amber-50 text-amber-700"
};

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function appointmentDateKey(value) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(value));
}

function formatTime(value) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function monthDays(monthDate) {
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const firstMondayIndex = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - firstMondayIndex);
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

function toIsoWithPakistanOffset(value) {
  if (!value) return "";
  return `${value}:00+05:00`;
}

export default function CalendarPage({ leads, showToast }) {
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ leadId: "", scheduledStart: "", notes: "" });

  const days = useMemo(() => monthDays(month), [month]);
  const appointmentsByDate = useMemo(() => {
    return appointments.reduce((groups, appointment) => {
      const key = appointmentDateKey(appointment.scheduledStart);
      groups[key] = [...(groups[key] || []), appointment];
      return groups;
    }, {});
  }, [appointments]);
  const selectedAppointments = appointmentsByDate[selectedDate] || [];

  async function loadAppointments() {
    const start = new Date(month.getFullYear(), month.getMonth() - 1, 24).toISOString();
    const end = new Date(month.getFullYear(), month.getMonth() + 2, 7).toISOString();
    setLoading(true);
    try {
      const result = await appointmentsService.getAppointments({ start, end });
      setAppointments(result.appointments || []);
    } catch (error) {
      showToast({ type: "error", title: "Calendar could not load", message: error.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAppointments();
  }, [month]);

  function openBookingForm() {
    const today = new Date();
    const chosenDate = selectedDate < dateKey(today) ? dateKey(today) : selectedDate;
    setForm({ leadId: "", scheduledStart: `${chosenDate}T09:00`, notes: "" });
    setShowForm(true);
  }

  async function handleCreate(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const result = await appointmentsService.createAppointment({
        leadId: form.leadId,
        scheduledStart: toIsoWithPakistanOffset(form.scheduledStart),
        durationMinutes: 30,
        notes: form.notes,
        source: "Manual"
      });
      setAppointments((current) => [...current, result.appointment].sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart)));
      setSelectedDate(appointmentDateKey(result.appointment.scheduledStart));
      setShowForm(false);
      showToast({ title: "Appointment booked", message: "The booking is now visible on the calendar." });
    } catch (error) {
      const alternatives = error.availableSlots?.length
        ? ` Available: ${error.availableSlots.map(formatTime).join(", ")}.`
        : "";
      showToast({ type: "error", title: "Booking failed", message: `${error.message}${alternatives}` });
    } finally {
      setSaving(false);
    }
  }

  async function handleStatus(appointment, status) {
    try {
      const result = await appointmentsService.updateAppointment(appointment.id, { status });
      setAppointments((current) => current.map((item) => (item.id === appointment.id ? result.appointment : item)));
      showToast({ title: "Appointment updated", message: `Status changed to ${status}.` });
    } catch (error) {
      showToast({ type: "error", title: "Update failed", message: error.message });
    }
  }

  function changeMonth(offset) {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  }

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-4 rounded-lg border border-emerald-100 bg-white p-5 shadow-soft sm:flex-row sm:items-center">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900"><CalendarDays size={20} className="text-emerald-600" /> Appointment calendar</h3>
          <p className="mt-1 text-sm text-gray-500">Clinic hours: Monday to Friday, 9:00 AM to 5:00 PM. Saturday and Sunday are closed.</p>
        </div>
        <button className="ml-auto inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700" onClick={openBookingForm}>
          <Plus size={18} /> New Appointment
        </button>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="overflow-hidden rounded-lg border border-emerald-100 bg-white shadow-soft">
          <div className="flex items-center justify-between border-b border-emerald-100 p-4">
            <button className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-50" onClick={() => changeMonth(-1)} aria-label="Previous month"><ChevronLeft size={19} /></button>
            <div className="text-center">
              <h3 className="font-bold text-gray-900">{month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</h3>
              <button className="mt-1 text-xs font-semibold text-emerald-700" onClick={() => { const now = new Date(); setMonth(new Date(now.getFullYear(), now.getMonth(), 1)); setSelectedDate(dateKey(now)); }}>Today</button>
            </div>
            <button className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-50" onClick={() => changeMonth(1)} aria-label="Next month"><ChevronRight size={19} /></button>
          </div>

          <div className="hidden grid-cols-7 border-b border-gray-100 bg-gray-50 md:grid">
            {WEEKDAYS.map((day) => <div key={day} className="px-2 py-3 text-center text-xs font-bold uppercase text-gray-500">{day}</div>)}
          </div>
          <div className="hidden grid-cols-7 md:grid">
            {days.map((day) => {
              const key = dateKey(day);
              const dayAppointments = appointmentsByDate[key] || [];
              const outside = day.getMonth() !== month.getMonth();
              const weekend = day.getDay() === 0 || day.getDay() === 6;
              const selected = key === selectedDate;
              return (
                <button key={key} className={`min-h-28 border-b border-r border-gray-100 p-2 text-left transition ${selected ? "bg-emerald-50 ring-2 ring-inset ring-emerald-400" : weekend ? "bg-gray-50" : "hover:bg-emerald-50/50"}`} onClick={() => setSelectedDate(key)}>
                  <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${outside ? "text-gray-300" : selected ? "bg-emerald-600 text-white" : "text-gray-700"}`}>{day.getDate()}</span>
                  {weekend && <p className="mt-1 text-[10px] font-semibold uppercase text-gray-400">Closed</p>}
                  <div className="mt-1 space-y-1">
                    {dayAppointments.slice(0, 2).map((appointment) => (
                      <div key={appointment.id} className="truncate rounded bg-emerald-100 px-1.5 py-1 text-[10px] font-semibold text-emerald-800">{formatTime(appointment.scheduledStart)} {appointment.patientName}</div>
                    ))}
                    {dayAppointments.length > 2 && <p className="text-[10px] font-semibold text-gray-500">+{dayAppointments.length - 2} more</p>}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="divide-y divide-gray-100 md:hidden">
            {days.filter((day) => day.getMonth() === month.getMonth()).map((day) => {
              const key = dateKey(day);
              const count = (appointmentsByDate[key] || []).length;
              const weekend = day.getDay() === 0 || day.getDay() === 6;
              return (
                <button key={key} className={`flex w-full items-center gap-3 px-4 py-3 text-left ${selectedDate === key ? "bg-emerald-50" : "bg-white"}`} onClick={() => setSelectedDate(key)}>
                  <span className="w-20 text-sm font-semibold text-gray-700">{day.toLocaleDateString("en-US", { weekday: "short", day: "numeric" })}</span>
                  <span className={`text-xs ${weekend ? "text-gray-400" : "text-emerald-700"}`}>{weekend ? "Closed" : count ? `${count} appointment${count === 1 ? "" : "s"}` : "Available"}</span>
                </button>
              );
            })}
          </div>
        </section>

        <aside className="rounded-lg border border-emerald-100 bg-white p-4 shadow-soft">
          <div className="border-b border-gray-100 pb-3">
            <p className="text-xs font-bold uppercase text-emerald-700">Selected day</p>
            <h3 className="mt-1 font-bold text-gray-900">{new Date(`${selectedDate}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</h3>
          </div>
          <div className="mt-4 space-y-3">
            {loading ? <p className="text-sm text-gray-500">Loading appointments...</p> : selectedAppointments.length === 0 ? (
              <EmptyState title="No appointments" message="No bookings are scheduled for this day." />
            ) : selectedAppointments.map((appointment) => (
              <article key={appointment.id} className="rounded-lg border border-gray-100 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="flex items-center gap-1.5 text-sm font-bold text-gray-900"><Clock3 size={15} className="text-emerald-600" /> {formatTime(appointment.scheduledStart)}</p>
                    <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-gray-800"><UserRound size={15} /> {appointment.patientName}</p>
                    <p className="mt-1 text-xs text-gray-500">{appointment.service}</p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${STATUS_STYLES[appointment.status]}`}>{appointment.status}</span>
                </div>
                <select className="form-input mt-3" value={appointment.status} onChange={(event) => handleStatus(appointment, event.target.value)}>
                  {Object.keys(STATUS_STYLES).map((status) => <option key={status}>{status}</option>)}
                </select>
              </article>
            ))}
          </div>
        </aside>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/45 p-4">
          <form className="w-full max-w-lg rounded-lg bg-white p-5 shadow-2xl" onSubmit={handleCreate}>
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div><h3 className="text-lg font-bold text-gray-900">New appointment</h3><p className="text-sm text-gray-500">Book a 30-minute clinic visit.</p></div>
              <button type="button" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" onClick={() => setShowForm(false)} aria-label="Close"><X size={20} /></button>
            </div>
            <div className="mt-4 space-y-4">
              <label className="block text-sm font-semibold text-gray-700">Lead<select className="form-input mt-1" required value={form.leadId} onChange={(event) => setForm({ ...form, leadId: event.target.value })}><option value="">Select a lead</option>{leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.name} - {lead.service}</option>)}</select></label>
              <label className="block text-sm font-semibold text-gray-700">Date and time<input className="form-input mt-1" type="datetime-local" required value={form.scheduledStart} onChange={(event) => setForm({ ...form, scheduledStart: event.target.value })} /></label>
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">Available Monday to Friday, 9:00 AM to 5:00 PM Pakistan time.</p>
              <label className="block text-sm font-semibold text-gray-700">Notes<textarea className="form-input mt-1 min-h-24 resize-y" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Optional booking notes" /></label>
            </div>
            <div className="mt-5 flex justify-end gap-3"><button type="button" className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700" onClick={() => setShowForm(false)}>Cancel</button><button disabled={saving} className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Booking..." : "Book Appointment"}</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
