import {
  ArrowRight,
  Bot,
  CalendarCheck,
  CheckCircle2,
  Clock,
  MapPin,
  Menu,
  MessageCircle,
  Mic,
  Phone,
  ShieldCheck,
  Sparkles,
  Star,
  X
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { RetellWebClient } from "retell-client-js-sdk";
import LeadForm from "../components/LeadForm";
import { chatbotService } from "../services/chatbotService";
import { leadsService } from "../services/leadsService";
import { voiceService } from "../services/voiceService";

const serviceCards = [
  {
    title: "Dental Fillings",
    text: "Natural-looking repairs for cavities and small tooth damage."
  },
  {
    title: "Root Canal",
    text: "Comfort-focused treatment planning for tooth pain concerns."
  },
  {
    title: "Teeth Whitening",
    text: "Brighten your smile with professional whitening guidance."
  },
  {
    title: "Dental Implants",
    text: "Consultation-first care for missing tooth replacement options."
  },
  {
    title: "Braces",
    text: "Explore alignment options for a more confident smile."
  },
  {
    title: "Bonding",
    text: "Simple cosmetic improvements for chips, gaps, and uneven edges."
  }
];

const stats = [
  { label: "Happy patients", value: "8k+" },
  { label: "Years of care", value: "14+" },
  { label: "Dental services", value: "6" }
];

const testimonials = [
  {
    name: "Sarah K.",
    text: "The team explained everything clearly and helped me book a consultation without any pressure."
  },
  {
    name: "Ahmed R.",
    text: "Clean clinic, polite staff, and quick follow-up after I submitted my appointment request."
  },
  {
    name: "Mina T.",
    text: "I used the online form and got a call back the same day. Very smooth experience."
  }
];

const initialChatMessages = [
  {
    role: "assistant",
    content: "Hi, I am the clinic assistant. Ask me about our dental services, or tell me what you need help with."
  }
];
const VOICE_CALL_CONNECT_TIMEOUT_MS = 15000;

function getErrorMessage(error, fallback = "Something went wrong. Please try again.") {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  return fallback;
}

function formatRetellTranscript(transcript) {
  if (!transcript) return "";
  if (typeof transcript === "string") return transcript;
  if (Array.isArray(transcript)) {
    return transcript
      .map((item) => {
        if (typeof item === "string") return item;
        const role = item?.role || item?.speaker || item?.sender;
        const content = item?.content || item?.text || item?.message || item?.transcript;
        return [role, content].filter(Boolean).join(": ");
      })
      .filter(Boolean)
      .join("\n");
  }
  if (typeof transcript === "object") {
    return transcript.content || transcript.text || transcript.message || JSON.stringify(transcript, null, 2);
  }
  return String(transcript);
}

function createChatSessionId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `chat_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export default function PublicLeadFormPage({ showToast }) {
  const retellClientRef = useRef(null);
  const callActiveRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [voiceConnecting, setVoiceConnecting] = useState(false);
  const [voiceCallActive, setVoiceCallActive] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState("Ready to start a secure voice call with our AI assistant.");
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [voiceError, setVoiceError] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [chatSessionId] = useState(createChatSessionId);
  const [chatMessages, setChatMessages] = useState(initialChatMessages);
  const [chatInput, setChatInput] = useState("");
  const [chatLeadCaptured, setChatLeadCaptured] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);

  useEffect(() => {
    return () => {
      if (callActiveRef.current && retellClientRef.current) {
        retellClientRef.current.stopCall();
      }
    };
  }, []);

  function getRetellClient() {
    if (retellClientRef.current) return retellClientRef.current;

    const client = new RetellWebClient();

    client.on("call_started", () => {
      callActiveRef.current = true;
      setVoiceConnecting(false);
      setVoiceCallActive(true);
      setVoiceStatus("Call connected. You can speak with the dental AI assistant now.");
      setVoiceError("");
    });

    client.on("call_ended", () => {
      callActiveRef.current = false;
      setVoiceConnecting(false);
      setVoiceCallActive(false);
      setVoiceStatus("Call ended. If you shared your email, the clinic team will follow up soon.");
    });

    client.on("agent_start_talking", () => {
      setVoiceStatus("AI assistant is speaking...");
    });

    client.on("agent_stop_talking", () => {
      setVoiceStatus("Listening. You can reply now.");
    });

    client.on("update", (update) => {
      if (update?.transcript) {
        setVoiceTranscript(formatRetellTranscript(update.transcript));
      }
    });

    client.on("error", (error) => {
      callActiveRef.current = false;
      setVoiceConnecting(false);
      setVoiceCallActive(false);
      setVoiceError(getErrorMessage(error, "Voice call failed. Please try again."));
      setVoiceStatus("Call stopped because an error occurred.");
      try {
        client.stopCall();
      } catch {
        // The SDK may already have closed the call by the time this event fires.
      }
    });

    retellClientRef.current = client;
    return client;
  }

  async function handleStartVoiceCall() {
    if (voiceConnecting || voiceCallActive) return;

    setVoiceError("");
    setVoiceTranscript("");
    setVoiceConnecting(true);
    setVoiceStatus("Creating secure voice session...");

    try {
      const response = await voiceService.createWebCall();
      if (!response.accessToken) {
        throw new Error("Retell did not return a web call access token.");
      }

      setVoiceStatus("Starting microphone call...");
      const client = getRetellClient();
      const timeout = new Promise((_, reject) => {
        window.setTimeout(() => {
          reject(new Error("Voice call could not connect. Please allow microphone access and try again."));
        }, VOICE_CALL_CONNECT_TIMEOUT_MS);
      });

      await Promise.race([
        client.startCall({
          accessToken: response.accessToken,
          sampleRate: 24000
        }),
        timeout
      ]);

      callActiveRef.current = true;
      setVoiceConnecting(false);
      setVoiceCallActive(true);
      setVoiceStatus("Call connected. You can speak with the dental AI assistant now.");
    } catch (error) {
      callActiveRef.current = false;
      setVoiceConnecting(false);
      setVoiceCallActive(false);
      const message = getErrorMessage(error, "Voice call failed. Please try again.");
      setVoiceError(message);
      setVoiceStatus("Voice assistant is unavailable right now.");
      try {
        retellClientRef.current?.stopCall();
      } catch {
        // Ignore cleanup errors after a failed connection attempt.
      }
      showToast({ type: "error", title: "Voice call failed", message });
    }
  }

  function handleStopVoiceCall() {
    if (!retellClientRef.current) return;
    setVoiceStatus("Ending call...");
    retellClientRef.current.stopCall();
  }

  function handleCloseVoicePanel() {
    if ((voiceCallActive || voiceConnecting) && retellClientRef.current) {
      retellClientRef.current.stopCall();
    }
    setVoiceOpen(false);
  }

  async function handleSubmit(payload) {
    setLoading(true);
    setSubmitted(false);
    try {
      await leadsService.createLead({
        ...payload,
        source: "Website Form",
        sourceDetail: "Dental clinic website form"
      });
      setSubmitted(true);
      showToast({ title: "Inquiry submitted", message: "Your details were saved successfully." });
    } catch (error) {
      showToast({ type: "error", title: "Submission failed", message: error.message });
      throw error;
    } finally {
      setLoading(false);
    }
  }

  async function handleChatSubmit(event) {
    event.preventDefault();
    const message = chatInput.trim();
    if (!message || chatLoading) return;

    const nextMessages = [...chatMessages, { role: "user", content: message }];
    setChatMessages(nextMessages);
    setChatInput("");
    setChatLoading(true);

    try {
      const response = await chatbotService.sendMessage({
        sessionId: chatSessionId,
        message,
        pageUrl: window.location.href,
        history: nextMessages.slice(-12)
      });

      setChatMessages((current) => [...current, { role: "assistant", content: response.reply }]);
      if (response.leadCaptured && !chatLeadCaptured) {
        setChatLeadCaptured(true);
        showToast({ title: "Chat lead captured", message: "The clinic team will follow up soon." });
      }
    } catch (error) {
      setChatMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: "I could not reach the AI assistant right now. Please use the form, or try again in a moment."
        }
      ]);
      showToast({ type: "error", title: "Chatbot unavailable", message: error.message });
    } finally {
      setChatLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-white via-emerald-50 to-green-100 text-gray-900">
      <header className="sticky top-0 z-30 border-b border-emerald-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 md:px-8">
          <a href="#home" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-600 text-white">
              <Sparkles size={22} />
            </div>
            <div>
              <p className="text-lg font-bold leading-tight">Pearl Dental Studio</p>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Modern smile care</p>
            </div>
          </a>

          <nav className="hidden items-center gap-7 text-sm font-semibold text-gray-600 lg:flex">
            <a className="hover:text-emerald-700" href="#services">Services</a>
            <a className="hover:text-emerald-700" href="#about">About</a>
            <a className="hover:text-emerald-700" href="#reviews">Reviews</a>
            <a className="hover:text-emerald-700" href="#contact">Contact</a>
          </nav>

          <div className="hidden items-center gap-3 lg:flex">
            <a className="rounded-lg bg-gradient-to-r from-emerald-600 to-green-500 px-5 py-2.5 text-sm font-bold text-white shadow hover:from-emerald-700 hover:to-green-600" href="#contact">
              Book Consultation
            </a>
          </div>

          <button className="rounded-lg border border-emerald-100 p-2 text-emerald-700 lg:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-emerald-100 bg-white px-4 py-4 lg:hidden">
            <div className="mx-auto grid max-w-7xl gap-3 text-sm font-semibold text-gray-700">
              <a href="#services" onClick={() => setMobileMenuOpen(false)}>Services</a>
              <a href="#about" onClick={() => setMobileMenuOpen(false)}>About</a>
              <a href="#reviews" onClick={() => setMobileMenuOpen(false)}>Reviews</a>
              <a href="#contact" onClick={() => setMobileMenuOpen(false)}>Contact</a>
              <a className="mt-2 rounded-lg bg-emerald-600 px-4 py-2 text-center font-bold text-white" href="#contact" onClick={() => setMobileMenuOpen(false)}>
                Book Consultation
              </a>
            </div>
          </div>
        )}
      </header>

      <section id="home" className="mx-auto grid max-w-7xl gap-10 px-4 py-14 md:px-8 md:py-20 lg:grid-cols-[1fr_0.92fr] lg:items-center">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-emerald-700 shadow-soft">
            <ShieldCheck size={17} />
            Trusted dental care for the whole family
          </div>
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-gray-950 md:text-6xl">
            Confident smiles start with a simple consultation.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-gray-600">
            Book a dental consultation, ask about a service, or let our team follow up with appointment options that fit your schedule.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-emerald-600 to-green-500 px-6 py-3 font-bold text-white shadow-lg hover:from-emerald-700 hover:to-green-600" href="#contact">
              Request Appointment <ArrowRight size={18} />
            </a>
            <button className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-white px-6 py-3 font-bold text-emerald-700 hover:bg-emerald-50" onClick={() => setChatOpen(true)}>
              Chat With Us <MessageCircle size={18} />
            </button>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-lg border border-emerald-100 bg-white/85 p-5 shadow-soft">
                <p className="text-3xl font-bold text-emerald-700">{stat.value}</p>
                <p className="mt-1 text-sm font-medium text-gray-500">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="overflow-hidden rounded-[2rem] border border-emerald-100 bg-white shadow-soft">
            <img
              className="h-[520px] w-full object-cover"
              src="https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=1200&q=85"
              alt="Modern dental clinic room"
            />
          </div>
          <div className="absolute -bottom-5 left-5 right-5 rounded-lg border border-emerald-100 bg-white p-4 shadow-soft sm:left-auto sm:w-72">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                <CalendarCheck size={22} />
              </div>
              <div>
                <p className="font-bold">Same-day follow-up</p>
                <p className="text-sm text-gray-500">Submit once and our care team responds quickly.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="services" className="bg-white py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-wide text-emerald-700">Our services</p>
            <h2 className="mt-3 text-3xl font-bold text-gray-950 md:text-4xl">Complete dental care in one place</h2>
            <p className="mt-4 text-gray-600">Choose the service you are interested in and we will help you plan the next step.</p>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {serviceCards.map((service) => (
              <div key={service.title} className="rounded-lg border border-emerald-100 bg-white p-6 shadow-soft transition hover:-translate-y-1 hover:shadow-lg">
                <CheckCircle2 className="text-emerald-600" size={24} />
                <h3 className="mt-4 text-lg font-bold">{service.title}</h3>
                <p className="mt-2 text-sm leading-6 text-gray-600">{service.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="about" className="py-16 md:py-24">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 md:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { icon: Clock, title: "Flexible hours", text: "Morning and evening consultation slots." },
              { icon: ShieldCheck, title: "Care-first guidance", text: "Clear options without pressure or confusion." },
              { icon: Phone, title: "Fast callbacks", text: "Our team responds quickly to new inquiries." },
              { icon: MapPin, title: "Easy to visit", text: "Convenient clinic location and friendly reception." }
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="rounded-lg border border-emerald-100 bg-white p-5 shadow-soft">
                  <Icon className="text-emerald-600" size={24} />
                  <h3 className="mt-4 font-bold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-gray-600">{item.text}</p>
                </div>
              );
            })}
          </div>
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-emerald-700">Why choose us</p>
            <h2 className="mt-3 text-3xl font-bold text-gray-950 md:text-4xl">A calm, modern clinic experience from first click to appointment.</h2>
            <p className="mt-5 text-lg leading-8 text-gray-600">
              We make dental consultations easier with simple online booking, clear follow-up, and a friendly team ready to answer general questions before your visit.
            </p>
            <div className="mt-7 space-y-3">
              {["Clean modern treatment rooms", "Friendly consultation process", "Service-specific appointment guidance"].map((item) => (
                <div key={item} className="flex items-center gap-3 text-gray-700">
                  <CheckCircle2 className="text-emerald-600" size={20} />
                  <span className="font-medium">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="reviews" className="bg-white py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-emerald-700">Patient stories</p>
              <h2 className="mt-3 text-3xl font-bold text-gray-950 md:text-4xl">A smoother way to start dental care</h2>
            </div>
            <div className="flex text-amber-400">
              {Array.from({ length: 5 }).map((_, index) => (
                <Star key={index} fill="currentColor" size={20} />
              ))}
            </div>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {testimonials.map((item) => (
              <div key={item.name} className="rounded-lg border border-emerald-100 bg-white p-6 shadow-soft">
                <p className="leading-7 text-gray-600">"{item.text}"</p>
                <p className="mt-5 font-bold text-gray-900">{item.name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="contact" className="py-16 md:py-24">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 md:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-emerald-700">Book a consultation</p>
            <h2 className="mt-3 text-3xl font-bold text-gray-950 md:text-4xl">Tell us what dental service you need.</h2>
            <p className="mt-4 text-lg leading-8 text-gray-600">
              Submit the form and our team will contact you to discuss appointment availability. This form does not provide diagnosis or medical advice.
            </p>
            <div className="mt-8 rounded-lg border border-emerald-100 bg-white p-5 shadow-soft">
              <p className="font-bold">Prefer quick help?</p>
              <p className="mt-2 text-sm leading-6 text-gray-600">Use the floating chat or voice button on the right side to share your details another way.</p>
            </div>
          </div>
          <div>
            {submitted && (
              <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
                <p className="font-semibold">Thank you. Your inquiry was received successfully.</p>
                <p className="mt-1 text-sm">A clinic representative will reach out shortly.</p>
              </div>
            )}
            <LeadForm
              onSubmit={handleSubmit}
              loading={loading}
              submitLabel="Request Consultation"
              initialValues={{
                source: "Website Form",
                sourceDetail: "Dental clinic website form"
              }}
            />
          </div>
        </div>
      </section>

      <footer className="bg-gray-950 py-10 text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 md:flex-row md:items-center md:justify-between md:px-8">
          <div>
            <p className="text-xl font-bold">Pearl Dental Studio</p>
            <p className="mt-2 text-sm text-gray-400">Modern dental consultations and friendly follow-up care.</p>
          </div>
          <div className="flex flex-col gap-2 text-sm text-gray-300 sm:flex-row sm:gap-6">
            <span>hello@pearldental.test</span>
            <span>+1 555 010 2026</span>
            <span>Mon to Sat, 9 AM to 7 PM</span>
          </div>
        </div>
      </footer>

      <div className="fixed bottom-5 right-5 z-40 flex flex-col gap-3">
        <button
          className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg transition hover:scale-105 hover:bg-emerald-700"
          onClick={() => {
            setVoiceOpen(true);
            setChatOpen(false);
          }}
          aria-label="Open voice assistant"
        >
          <Mic size={24} />
        </button>
        <button
          className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-950 text-white shadow-lg transition hover:scale-105 hover:bg-gray-800"
          onClick={() => {
            setChatOpen(true);
            setVoiceOpen(false);
          }}
          aria-label="Open chatbot"
        >
          <Bot size={24} />
        </button>
      </div>

      {voiceOpen && (
        <FloatingPanel title="AI Voice Assistant" onClose={handleCloseVoicePanel}>
          <div className="space-y-4">
            <div className="rounded-lg bg-emerald-50 p-4 text-emerald-800">
              <p className="font-bold">Talk with our AI receptionist</p>
              <p className="mt-1 text-sm">Click start, allow microphone access, and share your dental service, name, email, and phone.</p>
            </div>

            <div className="rounded-lg border border-emerald-100 bg-white p-4">
              <div className="flex items-center gap-3">
                <span className={`h-3 w-3 rounded-full ${voiceCallActive ? "bg-emerald-500" : voiceConnecting ? "bg-amber-400" : "bg-gray-300"}`} />
                <p className="text-sm font-semibold text-gray-800">{voiceStatus}</p>
              </div>
              {voiceError && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">{voiceError}</p>}
              {voiceTranscript && (
                <div className="mt-3 max-h-32 overflow-y-auto rounded-lg bg-gray-50 p-3 text-sm leading-6 text-gray-600">
                  {voiceTranscript}
                </div>
              )}
            </div>

            {voiceCallActive ? (
              <button className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-3 font-bold text-white hover:bg-red-700" onClick={handleStopVoiceCall}>
                End Call <Phone size={18} />
              </button>
            ) : (
              <button
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={handleStartVoiceCall}
                disabled={voiceConnecting}
              >
                {voiceConnecting ? "Starting..." : "Start Voice Call"} <Phone size={18} />
              </button>
            )}

            <p className="text-xs leading-5 text-gray-500">
              The call is handled by Retell AI. Leads are saved after call analysis when email, phone, name, and service are collected.
            </p>
          </div>
        </FloatingPanel>
      )}

      {chatOpen && (
        <FloatingPanel title="Dental Chat Assistant" onClose={() => setChatOpen(false)}>
          <form className="space-y-4" onSubmit={handleChatSubmit}>
            <div className="h-80 space-y-3 overflow-y-auto rounded-lg bg-gray-50 p-3">
              {chatMessages.map((message, index) => (
                <div key={`${message.role}-${index}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-6 ${message.role === "user" ? "bg-emerald-600 text-white" : "bg-white text-gray-700 shadow-sm"}`}>
                    {message.content}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="rounded-lg bg-white px-3 py-2 text-sm text-gray-500 shadow-sm">Thinking...</div>
                </div>
              )}
            </div>

            {chatLeadCaptured && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
                Your details were captured. The clinic team will follow up soon.
              </div>
            )}

            <div className="flex gap-2">
              <input
                className="form-input"
                placeholder="Type your question..."
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
              />
              <button className="rounded-lg bg-emerald-600 px-4 font-bold text-white hover:bg-emerald-700 disabled:opacity-60" disabled={chatLoading || !chatInput.trim()}>
                Send
              </button>
            </div>
            <p className="text-xs leading-5 text-gray-500">
              The assistant can answer general service questions and collect name, phone, email, and service for clinic follow-up.
            </p>
          </form>
        </FloatingPanel>
      )}
    </main>
  );
}

function FloatingPanel({ title, children, onClose }) {
  return (
    <div className="fixed bottom-36 right-5 z-40 w-[calc(100vw-2.5rem)] max-w-sm rounded-lg border border-emerald-100 bg-white shadow-soft">
      <div className="flex items-center justify-between border-b border-emerald-100 p-4">
        <h3 className="font-bold text-gray-900">{title}</h3>
        <button className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" onClick={onClose}>
          <X size={18} />
        </button>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
