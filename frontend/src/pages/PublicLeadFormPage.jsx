import {
  Activity,
  AlignCenter,
  ArrowRight,
  ArrowUp,
  Baby,
  CalendarCheck,
  Check,
  CircleDot,
  Crown,
  HeartHandshake,
  HeartPulse,
  Maximize2,
  MessageCircle,
  MessagesSquare,
  Minimize2,
  Phone,
  PhoneCall,
  PhoneOff,
  ScanFace,
  ShieldPlus,
  ShieldCheck,
  Smile,
  Sparkles,
  Star,
  Stethoscope,
  WandSparkles,
  X
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { RetellWebClient } from "retell-client-js-sdk";
import LeadForm from "../components/LeadForm";
import { chatbotService } from "../services/chatbotService";
import { leadsService } from "../services/leadsService";
import { voiceService } from "../services/voiceService";
import ConversationMessage, { parseConversationTranscript } from "../components/ConversationMessage";
import { SERVICE_KNOWLEDGE } from "../utils/constants";

const serviceCards = [
  {
    icon: Stethoscope,
    title: "General Dentistry",
    text: "Complete preventive care for a healthy smile."
  },
  {
    icon: Smile,
    title: "Cosmetic Dentistry",
    text: "Personalized treatments designed to enhance your smile."
  },
  {
    icon: Baby,
    title: "Pediatric Dentistry",
    text: "Gentle dental care for children and growing smiles."
  },
  {
    icon: Sparkles,
    title: "Scaling & Polishing",
    text: "Professional cleaning for fresher, healthier teeth."
  },
  {
    icon: ScanFace,
    title: "Maxillofacial Surgery",
    text: "Specialist facial and jaw treatment planning."
  },
  {
    icon: WandSparkles,
    title: "Teeth Whitening",
    text: "Professional whitening for a visibly brighter smile."
  },
  {
    icon: CircleDot,
    title: "Dental Fillings",
    text: "Durable, natural-looking repair for damaged teeth."
  },
  {
    icon: AlignCenter,
    title: "Orthodontics",
    text: "Braces and alignment options for a balanced smile."
  },
  {
    icon: Activity,
    title: "Tooth Extraction",
    text: "Careful removal when a tooth cannot be restored."
  },
  {
    icon: Crown,
    title: "Dental Crowns",
    text: "Protect and strengthen teeth with custom crowns."
  },
  {
    icon: HeartPulse,
    title: "Root Canal",
    text: "Relieve pain and save an infected natural tooth."
  },
  {
    icon: Smile,
    title: "Veneers",
    text: "Refine the shape and appearance of your smile."
  },
  {
    icon: ShieldPlus,
    title: "Dental Implants",
    text: "Long-term replacement options for missing teeth."
  },
  {
    icon: HeartHandshake,
    title: "Dentures",
    text: "Comfortable custom solutions to restore confidence."
  },
  {
    icon: AlignCenter,
    title: "Clear Aligners",
    text: "Discreet removable aligners for straighter teeth."
  },
  {
    icon: Activity,
    title: "Gum Recontouring",
    text: "Reshape the gumline for a more balanced smile."
  }
];

const stats = [
  { icon: HeartHandshake, label: "Happy Patients", value: "150+" },
  { icon: Sparkles, label: "Smile Restorations", value: "500+" },
  { icon: ShieldCheck, label: "Routine Treatments", value: "800+" }
];

const smileResults = [
  {
    image: "/images/smile-whitening-before-after.png",
    title: "Professional Whitening",
    description: "A brighter smile with a natural-looking shade."
  },
  {
    image: "/images/smile-veneers-before-after.png",
    title: "Cosmetic Veneers",
    description: "Refined spacing and shape with a balanced finish."
  },
  {
    image: "/images/smile-aligners-before-after.png",
    title: "Clear Aligner Treatment",
    description: "Gentle alignment for a straighter, healthier smile."
  }
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
const CHAT_MEMORY_KEY = "brightsmile-chat-memory-v1";
const MAX_CHAT_MESSAGES = 50;

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
  const chatScrollRef = useRef(null);
  const voiceScrollRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [voiceConnecting, setVoiceConnecting] = useState(false);
  const [voiceCallActive, setVoiceCallActive] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState("Ready to start a secure voice call with our AI assistant.");
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [voiceError, setVoiceError] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [chatSessionId] = useState(() => {
    const saved = window.localStorage.getItem(`${CHAT_MEMORY_KEY}:session`);
    const sessionId = saved || createChatSessionId();
    window.localStorage.setItem(`${CHAT_MEMORY_KEY}:session`, sessionId);
    return sessionId;
  });
  const [chatMessages, setChatMessages] = useState(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(`${CHAT_MEMORY_KEY}:messages`) || "null");
      return Array.isArray(saved) && saved.length ? saved.slice(-MAX_CHAT_MESSAGES) : initialChatMessages;
    } catch {
      return initialChatMessages;
    }
  });
  const [chatInput, setChatInput] = useState("");
  const [chatLeadCaptured, setChatLeadCaptured] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatBookingOpen, setChatBookingOpen] = useState(false);
  const [chatBookingLoading, setChatBookingLoading] = useState(false);
  const [chatBookingError, setChatBookingError] = useState("");
  const [chatBooking, setChatBooking] = useState({ name: "", email: "", phone: "", service: "", scheduledDate: "", scheduledTime: "", notes: "" });

  useEffect(() => {
    return () => {
      if (callActiveRef.current && retellClientRef.current) {
        retellClientRef.current.stopCall();
      }
    };
  }, []);

  useEffect(() => {
    chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight });
  }, [chatMessages, chatLoading, chatOpen]);

  useEffect(() => {
    window.localStorage.setItem(`${CHAT_MEMORY_KEY}:messages`, JSON.stringify(chatMessages.slice(-MAX_CHAT_MESSAGES)));
  }, [chatMessages]);

  useEffect(() => {
    voiceScrollRef.current?.scrollTo({ top: voiceScrollRef.current.scrollHeight });
  }, [voiceTranscript]);

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
      setVoiceStatus("Call ended");
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
      const response = await voiceService.createWebCall({ serviceCatalog: SERVICE_KNOWLEDGE });
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
        history: nextMessages.slice(-MAX_CHAT_MESSAGES),
        serviceCatalog: SERVICE_KNOWLEDGE
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

  function showChatServices() {
    setChatMessages((current) => [
      ...current,
      { role: "user", content: "View Services" },
      { role: "assistant", content: `Here are our services:\n\n${SERVICE_KNOWLEDGE.map((item) => `- ${item.name}`).join("\n")}\n\nWhich service are you looking for?` },
    ]);
  }

  async function handleChatBooking(event) {
    event.preventDefault();
    if (chatBookingLoading) return;
    setChatBookingError("");
    const selected = new Date(`${chatBooking.scheduledDate}T${chatBooking.scheduledTime}`);
    if (!chatBooking.scheduledDate || !chatBooking.scheduledTime) {
      setChatBookingError("Choose a weekday and an available time.");
      return;
    }
    if ([0, 6].includes(selected.getDay())) {
      setChatBookingError("The clinic is closed on Saturday and Sunday. Choose Monday to Friday.");
      return;
    }
    if (selected <= new Date()) {
      setChatBookingError("Choose a future date and time.");
      return;
    }
    setChatBookingLoading(true);
    try {
      const response = await chatbotService.bookAppointment({
        ...chatBooking,
        sessionId: chatSessionId,
        scheduledStart: `${chatBooking.scheduledDate}T${chatBooking.scheduledTime}:00`,
      });
      setChatMessages((current) => [
        ...current,
        { role: "user", content: "Book an Appointment" },
        { role: "assistant", content: response.message || "Your appointment is booked successfully. We look forward to seeing you." },
      ]);
      setChatLeadCaptured(true);
      setChatBookingOpen(false);
      setChatBooking({ name: "", email: "", phone: "", service: "", scheduledDate: "", scheduledTime: "", notes: "" });
      showToast({ title: "Appointment booked", message: "Your lead and appointment were saved successfully." });
    } catch (error) {
      setChatBookingError(error.message || "That time is unavailable. Please choose another slot.");
      showToast({ type: "error", title: "Booking failed", message: error.message });
    } finally {
      setChatBookingLoading(false);
    }
  }

  return (
    <main className="public-site min-h-screen bg-emerald-50 text-gray-900">
      <section id="home" className="bg-emerald-800 text-white">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-14 md:px-8 md:py-20 lg:min-h-[610px] lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div className="relative z-10">
            <div className="mb-5 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-emerald-100">
              <CalendarCheck size={18} />
              Book a dental consultation
            </div>
            <h1 className="max-w-2xl font-serif text-5xl font-bold leading-[1.05] md:text-6xl">
              Best Dental Clinic in Islamabad
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-emerald-50">
              Trusted, comfortable dental care for families across Islamabad. From routine checkups to smile restoration, our team makes every visit clear and reassuring.
            </p>
            <a className="mt-8 inline-flex items-center justify-center gap-2 rounded-lg bg-white px-6 py-3.5 font-bold text-emerald-800 shadow-lg transition hover:bg-emerald-50" href="#contact">
              Book an Appointment <ArrowRight size={18} />
            </a>
          </div>

          <div className="relative mx-auto w-full max-w-[590px] py-5">
            <div className="absolute inset-0 m-auto h-[92%] w-[92%] rounded-full border-2 border-dashed border-emerald-200/80" />
            <div className="relative mx-auto aspect-square w-[88%] overflow-hidden rounded-full border-[10px] border-white/15 shadow-2xl">
              <img
                className="h-full w-full object-cover"
                src="/images/brightsmile-dental-hero.png"
                alt="Dentist consulting with a patient at BrightSmile Dental Center in Islamabad"
              />
            </div>
            <div className="absolute left-0 top-8 flex h-28 w-28 flex-col items-center justify-center rounded-full border-4 border-emerald-800 bg-emerald-100 text-center text-emerald-900 shadow-xl sm:h-32 sm:w-32">
              <Sparkles size={24} />
              <span className="mt-1 text-sm font-bold leading-tight">Modern Smile Care</span>
            </div>
            <div className="absolute bottom-8 right-0 rounded-lg border border-emerald-100 bg-white p-4 text-gray-900 shadow-xl sm:right-3">
              <div className="flex items-center gap-3">
                <CalendarCheck className="text-emerald-700" size={24} />
                <div>
                  <p className="font-bold">Easy appointment booking</p>
                  <p className="text-sm text-gray-500">Quick follow-up from our care team</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section aria-label="Clinic achievements" className="border-b border-emerald-100 bg-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-9 sm:grid-cols-3 md:px-8 md:py-11">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="flex items-center justify-center gap-4 sm:justify-start">
                <Icon className="shrink-0 text-emerald-600" size={44} strokeWidth={1.7} />
                <div>
                  <p className="font-serif text-4xl font-bold leading-none text-emerald-800">{stat.value}</p>
                  <p className="mt-2 text-sm font-semibold text-gray-500">{stat.label}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section id="services" className="bg-white py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-wide text-emerald-700">Our services</p>
            <h2 className="mt-3 text-3xl font-bold text-gray-950 md:text-4xl">Complete dental care in one place</h2>
            <p className="mt-4 text-gray-600">Choose the service you are interested in and we will help you plan the next step.</p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {serviceCards.map((service) => {
              const Icon = service.icon;
              return (
                <div key={service.title} className="rounded-lg border border-emerald-100 bg-white p-5 transition hover:-translate-y-1 hover:border-emerald-300 hover:shadow-lg">
                  <Icon className="text-emerald-600" size={30} strokeWidth={1.7} />
                  <h3 className="mt-4 font-serif text-xl font-bold text-emerald-900">{service.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-gray-600">{service.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="results" className="border-y border-emerald-100 bg-emerald-50 py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-bold uppercase tracking-wide text-emerald-700">Realistic smile outcomes</p>
            <h2 className="mt-3 text-3xl font-bold text-gray-950 md:text-4xl">Before &amp; After</h2>
            <p className="mt-4 text-gray-600">See how thoughtful treatment planning can improve smile health, balance, and confidence.</p>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {smileResults.map((result) => (
              <article key={result.title} className="overflow-hidden rounded-lg border border-emerald-100 bg-white shadow-sm">
                <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
                  <img className="h-full w-full object-cover" src={result.image} alt={`${result.title} illustrative before and after smile result`} />
                  <span className="absolute left-3 top-3 rounded-md bg-gray-950/85 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">Before</span>
                  <span className="absolute bottom-3 left-3 rounded-md bg-emerald-700 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">After</span>
                </div>
                <div className="p-5">
                  <h3 className="font-serif text-xl font-bold text-emerald-900">{result.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-gray-600">{result.description}</p>
                </div>
              </article>
            ))}
          </div>

          <p className="mt-6 text-center text-xs leading-5 text-gray-500">Illustrative treatment examples. Individual needs and results vary after clinical assessment.</p>
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
        <div className="mx-auto max-w-3xl px-4 md:px-8">
          <div className="w-full">
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
            <p className="text-xl font-bold">BrightSmile Dental Center</p>
            <p className="mt-2 text-sm text-gray-400">Modern dental consultations and friendly follow-up care.</p>
          </div>
          <div className="flex flex-col gap-2 text-sm text-gray-300 sm:flex-row sm:gap-6">
            <span>hello@brightsmiledentalcenter.com</span>
            <span>Islamabad, Pakistan</span>
            <span>Mon to Fri, 9 AM to 5 PM</span>
          </div>
        </div>
      </footer>

      <div className="assistant-dock fixed bottom-5 right-5 z-40">
        <div className="assistant-dock__copy">
          <span className="assistant-dock__eyebrow">Need a hand?</span>
          <span className="assistant-dock__hint">Our team is here</span>
        </div>
        <div className="assistant-dock__actions">
        <LauncherButton
          icon={PhoneCall}
          label="Talk"
          tone="voice"
          active={voiceOpen}
          ariaLabel={voiceOpen ? "Close voice assistant" : "Open voice assistant"}
          onClick={() => {
            if (voiceOpen) {
              handleCloseVoicePanel();
              return;
            }
            setVoiceOpen(true);
            setChatOpen(false);
          }}
        />
        <LauncherButton
          icon={MessagesSquare}
          label="Chat"
          tone="chat"
          active={chatOpen}
          ariaLabel={chatOpen ? "Close chat" : "Open chat"}
          onClick={() => {
            if (!chatOpen) handleCloseVoicePanel();
            setChatOpen((value) => !value);
          }}
        />
        </div>
      </div>

      {voiceOpen && (
        <FloatingPanel
          icon={PhoneCall}
          title="Talk to the clinic"
          subtitle={voiceCallActive ? "On a call now" : "Voice call in your browser"}
          live={voiceCallActive}
          onClose={handleCloseVoicePanel}
        >
          <div className="flex h-full min-h-0 flex-col">
            <div className={voiceTranscript ? "flex items-center gap-3 px-4 py-3" : "flex flex-1 flex-col items-center justify-center px-6 text-center"}>
              <VoiceBars active={voiceCallActive} connecting={voiceConnecting} small={Boolean(voiceTranscript)} />
              <div className={voiceTranscript ? "min-w-0" : "mt-5"}>
                <p className="text-[15px] font-semibold text-[#171b18]">
                  {voiceCallActive ? "You're on the call" : voiceConnecting ? "Connecting" : "Speak with our receptionist"}
                </p>
                <p className="mt-0.5 text-sm leading-5 text-[#68726b]">{voiceStatus}</p>
              </div>
            </div>

            {voiceError && <p className="mx-4 mb-3 rounded-xl bg-red-50 px-3 py-2.5 text-sm leading-5 text-red-700">{voiceError}</p>}

            {voiceTranscript && (
              <div ref={voiceScrollRef} className="app-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto border-t border-[#edf1ea] px-4 py-4">
                {parseConversationTranscript(voiceTranscript).map((message, index) => (
                  <ConversationMessage key={`${message.role}-${index}`} {...message} />
                ))}
              </div>
            )}

            <div className="border-t border-[#edf1ea] p-3">
              {voiceCallActive ? (
                <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#c8372d] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#ab2c23]" onClick={handleStopVoiceCall}>
                  <PhoneOff size={17} /> End call
                </button>
              ) : (
                <button
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1d1f1c] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#343832] disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={handleStartVoiceCall}
                  disabled={voiceConnecting}
                >
                  <Phone size={17} /> {voiceConnecting ? "Connecting" : "Start call"}
                </button>
              )}
              {!voiceCallActive && !voiceConnecting && (
                <p className="mt-2 text-center text-xs text-[#8a938c]">Your browser will ask to use the microphone.</p>
              )}
            </div>
          </div>
        </FloatingPanel>
      )}

      {chatOpen && (
        <FloatingPanel icon={MessagesSquare} title="Chat with the clinic" subtitle="Usually replies in a few seconds" onClose={() => setChatOpen(false)}>
          <div className="flex h-full min-h-0 flex-col">
            <div ref={chatScrollRef} className="app-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-4">
              {chatMessages.map((message, index) => (
                <ConversationMessage key={`${message.role}-${index}`} role={message.role} content={message.content} />
              ))}
              {chatLoading && <ConversationMessage typing />}
            </div>

            {chatBookingOpen && (
              <form className="app-scrollbar max-h-[62%] shrink-0 overflow-y-auto border-t border-[#edf1ea] px-4 py-4" onSubmit={handleChatBooking}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[15px] font-semibold text-[#171b18]">Book an appointment</p>
                    <p className="mt-0.5 text-xs leading-5 text-[#68726b]">Monday to Friday, 9 AM to 5 PM. Visits are 30 minutes.</p>
                  </div>
                  <button type="button" className="rounded-lg p-1.5 text-[#68726b] transition hover:bg-[#f3f7f0] hover:text-[#171b18]" onClick={() => setChatBookingOpen(false)} aria-label="Cancel booking">
                    <X size={17} />
                  </button>
                </div>
                <div className="mt-3 grid gap-2">
                  <input className="form-input" required placeholder="Full name" aria-label="Full name" value={chatBooking.name} onChange={(event) => setChatBooking((current) => ({ ...current, name: event.target.value }))} />
                  <div className="grid grid-cols-2 gap-2">
                    <input className="form-input" required type="email" placeholder="Email" aria-label="Email address" value={chatBooking.email} onChange={(event) => setChatBooking((current) => ({ ...current, email: event.target.value }))} />
                    <input className="form-input" required placeholder="Phone" aria-label="Phone number" value={chatBooking.phone} onChange={(event) => setChatBooking((current) => ({ ...current, phone: event.target.value }))} />
                  </div>
                  <select className="form-input" required aria-label="Service" value={chatBooking.service} onChange={(event) => setChatBooking((current) => ({ ...current, service: event.target.value }))}>
                    <option value="">Select a service</option>
                    {SERVICE_KNOWLEDGE.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-xs font-medium text-[#68726b]">Date
                      <input className="form-input mt-1" required type="date" min={new Date().toISOString().slice(0, 10)} value={chatBooking.scheduledDate} onChange={(event) => setChatBooking((current) => ({ ...current, scheduledDate: event.target.value }))} />
                    </label>
                    <label className="text-xs font-medium text-[#68726b]">Time
                      <select className="form-input mt-1" required value={chatBooking.scheduledTime} onChange={(event) => setChatBooking((current) => ({ ...current, scheduledTime: event.target.value }))}>
                        <option value="">Select a time</option>
                        {Array.from({ length: 16 }, (_, index) => {
                          const hour = 9 + Math.floor(index / 2);
                          const minute = index % 2 ? "30" : "00";
                          const value = `${String(hour).padStart(2, "0")}:${minute}`;
                          const label = `${hour > 12 ? hour - 12 : hour}:${minute} ${hour >= 12 ? "PM" : "AM"}`;
                          return <option key={value} value={value}>{label}</option>;
                        })}
                      </select>
                    </label>
                  </div>
                </div>
                {chatBookingError && <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">{chatBookingError}</p>}
                <button className="mt-3 w-full rounded-xl bg-[#1d1f1c] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#343832] disabled:opacity-60" disabled={chatBookingLoading}>
                  {chatBookingLoading ? "Booking" : "Confirm booking"}
                </button>
              </form>
            )}

            {!chatBookingOpen && (
              <div className="shrink-0 border-t border-[#edf1ea] p-3">
                {chatLeadCaptured ? (
                  <p className="mb-2.5 flex items-center gap-2 px-1 text-sm text-[#087f5b]">
                    <Check size={16} strokeWidth={2.5} /> We have your details. The clinic team will follow up soon.
                  </p>
                ) : (
                  <div className="mb-2.5 flex flex-wrap gap-1.5">
                    <button type="button" className="rounded-full border border-[#dce9d7] bg-white px-3 py-1.5 text-[13px] font-medium text-[#263229] transition hover:border-[#8ec879] hover:bg-[#eff8eb]" onClick={() => setChatBookingOpen(true)}>
                      Book an appointment
                    </button>
                    <button type="button" className="rounded-full border border-[#dce9d7] bg-white px-3 py-1.5 text-[13px] font-medium text-[#263229] transition hover:border-[#8ec879] hover:bg-[#eff8eb]" onClick={showChatServices}>
                      View services
                    </button>
                  </div>
                )}
                <form className="flex items-center gap-2 rounded-2xl border border-[#dce5d8] bg-white py-1.5 pl-3.5 pr-1.5 transition focus-within:border-[#72b65b] focus-within:shadow-[0_0_0_4px_rgba(186,255,152,0.35)]" onSubmit={handleChatSubmit}>
                  <input
                    className="min-w-0 flex-1 bg-transparent py-1.5 text-sm text-[#242a25] outline-none placeholder:text-[#9aa39c]"
                    placeholder="Write a message"
                    aria-label="Message"
                    value={chatInput}
                    onChange={(event) => setChatInput(event.target.value)}
                  />
                  <button className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#1d1f1c] text-white transition hover:bg-[#343832] disabled:bg-[#e6ebe3] disabled:text-[#9aa39c]" disabled={chatLoading || !chatInput.trim()} aria-label="Send message">
                    <ArrowUp size={18} strokeWidth={2.4} />
                  </button>
                </form>
              </div>
            )}
          </div>
        </FloatingPanel>
      )}
    </main>
  );
}

function LauncherButton({ icon: Icon, label, tone, active, ariaLabel, onClick }) {
  return (
    <button
      className={`assistant-dock__button assistant-dock__button--${tone} ${active ? "is-active" : ""}`}
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={active}
    >
      <span className="assistant-dock__icon"><Icon size={17} strokeWidth={2.2} /></span>
      <span>{label}</span>
    </button>
  );
}

function VoiceBars({ active, connecting, small }) {
  return (
    <div
      className={`voice-bars flex shrink-0 items-center justify-center gap-[3px] rounded-full ${small ? "h-11 w-11" : "h-24 w-24 gap-[5px]"} ${
        active ? "voice-bars-live bg-[#1d1f1c] text-[#baff98]" : connecting ? "voice-bars-wait bg-[#eff8eb] text-[#087f5b]" : "bg-[#eff8eb] text-[#087f5b]"
      }`}
      aria-hidden="true"
    >
      {[0.45, 0.8, 1, 0.65, 0.4].map((height, index) => (
        <span key={index} className={`rounded-full bg-current ${small ? "w-[3px]" : "w-[5px]"}`} style={{ height: `${height * (small ? 18 : 40)}px`, animationDelay: `${index * 0.12}s` }} />
      ))}
    </div>
  );
}

function FloatingPanel({ icon: Icon, title, subtitle, live = false, children, onClose }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`flex flex-col overflow-hidden border-[#e2ebe0] bg-white transition-[width,transform] duration-300 ease-out ${
        expanded
          ? "fixed inset-y-0 right-0 z-50 w-[25vw] min-w-[340px] max-w-[520px] border-l shadow-[0_0_48px_rgba(23,27,24,0.16)] max-sm:w-full"
          : "fixed bottom-24 right-5 z-40 h-[min(600px,calc(100vh-7.5rem))] w-[calc(100vw-2rem)] max-w-[460px] rounded-[20px] border shadow-[0_18px_50px_rgba(23,27,24,0.16)]"
      }`}
    >
      <div className="assistant-panel__header flex shrink-0 items-center gap-3 border-b border-[#edf1ea] px-4 py-3.5">
        <div className="assistant-panel__icon flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#dff4d7] text-[#087f5b]">
          <Icon size={19} strokeWidth={2.1} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-[#171b18]">{title}</p>
          <p className="flex items-center gap-1.5 truncate text-xs text-[#68726b]">
            {live && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#c8372d]" />}
            {subtitle}
          </p>
        </div>
        <button
          className="rounded-lg p-2 text-[#68726b] transition hover:bg-[#f3f7f0] hover:text-[#171b18] max-sm:hidden"
          onClick={() => setExpanded((value) => !value)}
          aria-label={expanded ? "Restore panel size" : "Expand panel"}
          title={expanded ? "Restore panel size" : "Expand panel"}
        >
          {expanded ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
        </button>
        <button className="rounded-lg p-2 text-[#68726b] transition hover:bg-[#f3f7f0] hover:text-[#171b18]" onClick={onClose} aria-label="Close panel" title="Close">
          <X size={18} />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
