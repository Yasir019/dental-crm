import {
  ArrowRight,
  ArrowUp,
  AudioLines,
  Check,
  Clock,
  Mail,
  MapPin,
  Maximize2,
  MessageCircle,
  Minimize2,
  Phone,
  PhoneOff,
  RotateCcw,
  Star,
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

const navLinks = [
  { href: "#services", label: "Services" },
  { href: "#results", label: "Results" },
  { href: "#reviews", label: "Reviews" },
  { href: "#contact", label: "Contact" }
];

const serviceGroups = [
  {
    title: "Everyday care",
    note: "Check-ups and prevention for the whole family",
    items: [
      { name: "General Dentistry", text: "Complete preventive care for a healthy smile." },
      { name: "Pediatric Dentistry", text: "Gentle dental care for children and growing smiles." },
      { name: "Scaling & Polishing", text: "Professional cleaning for fresher, healthier teeth." },
      { name: "Dental Fillings", text: "Durable, natural-looking repair for damaged teeth." }
    ]
  },
  {
    title: "Smile design",
    note: "Treatments that change how your smile looks",
    items: [
      { name: "Cosmetic Dentistry", text: "Personalized treatments designed to enhance your smile." },
      { name: "Teeth Whitening", text: "Professional whitening for a visibly brighter smile." },
      { name: "Veneers", text: "Refine the shape and appearance of your smile." },
      { name: "Gum Recontouring", text: "Reshape the gumline for a more balanced smile." }
    ]
  },
  {
    title: "Repair and replace",
    note: "Saving damaged teeth and replacing missing ones",
    items: [
      { name: "Root Canal", text: "Relieve pain and save an infected natural tooth." },
      { name: "Dental Crowns", text: "Protect and strengthen teeth with custom crowns." },
      { name: "Dental Implants", text: "Long-term replacement options for missing teeth." },
      { name: "Dentures", text: "Comfortable custom solutions to restore confidence." }
    ]
  },
  {
    title: "Alignment and surgery",
    note: "Straighter teeth and specialist procedures",
    items: [
      { name: "Orthodontics", text: "Braces and alignment options for a balanced smile." },
      { name: "Clear Aligners", text: "Discreet removable aligners for straighter teeth." },
      { name: "Tooth Extraction", text: "Careful removal when a tooth cannot be restored." },
      { name: "Maxillofacial Surgery", text: "Specialist facial and jaw treatment planning." }
    ]
  }
];

const stats = [
  { label: "Happy patients", value: "150+" },
  { label: "Smile restorations", value: "500+" },
  { label: "Routine treatments", value: "800+" }
];

const bookingSteps = [
  { title: "Send your details", text: "Your name, how to reach you, and the treatment you are interested in." },
  { title: "We call you back", text: "Reception agrees a day and time with you during clinic hours." },
  { title: "Visit the clinic", text: "A dentist examines you and explains your options before any treatment." }
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
    content: "Hi, I'm the BrightSmile assistant. Ask about a treatment or our hours, or tell me what's bothering you and I'll point you to the right care."
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
  const [selectedService, setSelectedService] = useState("");
  const [voiceStatus, setVoiceStatus] = useState("Ask about a treatment or our hours, or leave your details for a call back.");
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [voiceError, setVoiceError] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [chatSessionId, setChatSessionId] = useState(() => {
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
    const previousTitle = document.title;
    document.title = "BrightSmile Dental Center, Islamabad";
    return () => {
      document.title = previousTitle;
    };
  }, []);

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

  function openVoice() {
    setChatOpen(false);
    setVoiceOpen(true);
  }

  function openChat() {
    handleCloseVoicePanel();
    setChatOpen(true);
  }

  function chooseService(service) {
    setSelectedService(service);
    setSubmitted(false);
    document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" });
  }

  function resetChat() {
    const sessionId = createChatSessionId();
    window.localStorage.setItem(`${CHAT_MEMORY_KEY}:session`, sessionId);
    setChatSessionId(sessionId);
    setChatMessages(initialChatMessages);
    setChatLeadCaptured(false);
    setChatBookingOpen(false);
    setChatInput("");
  }

  function handleChatSubmit(event) {
    event.preventDefault();
    sendChatMessage(chatInput);
  }

  async function sendChatMessage(text) {
    const message = text.trim();
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
          content: "That message did not go through. Try again in a moment, or use the consultation form on this page."
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
      { role: "user", content: "View services" },
      { role: "assistant", content: `Here are our services:\n\n${SERVICE_KNOWLEDGE.map((item) => `- ${item.name}`).join("\n")}\n\nWhich one are you interested in?` },
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
      <header className="sticky top-0 z-30 border-b border-[#cbe5c1] bg-[#dff4d7]/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1260px] items-center justify-between gap-6 px-4 py-3 md:px-8">
          <a href="#home" className="flex items-center gap-2.5 text-[#152019]">
            <BrandMark />
            <span className="whitespace-nowrap text-[17px] font-bold tracking-tight">BrightSmile<span className="max-sm:hidden"> Dental Center</span></span>
          </a>
          <nav className="hidden items-center gap-7 text-sm font-medium text-[#3a4840] md:flex" aria-label="Page sections">
            {navLinks.map((link) => (
              <a key={link.href} href={link.href} className="transition hover:text-[#087f5b]">
                {link.label}
              </a>
            ))}
          </nav>
          <a href="#contact" className="whitespace-nowrap rounded-full bg-[#1d1f1c] px-4 py-2 text-sm font-semibold text-[#fff] transition hover:bg-[#343832]">
            Book a visit
          </a>
        </div>
      </header>

      <section id="home" className="bg-[#dff4d7]">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 pb-14 pt-10 md:px-8 md:pb-20 md:pt-14 lg:grid-cols-[1fr_1.05fr] lg:items-center lg:gap-14">
          <div>
            <h1 className="max-w-xl text-[2.75rem] leading-[1.03] text-[#152019] sm:text-6xl">Best Dental Clinic in Islamabad</h1>
            <p className="mt-6 max-w-lg text-lg leading-8 text-[#3a4840]">
              Trusted, comfortable dental care for families across Islamabad. From routine checkups to smile restoration, our team makes every visit clear and reassuring.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a className="inline-flex items-center gap-2 rounded-full bg-[#1d1f1c] px-6 py-3.5 text-[15px] font-semibold text-[#fff] transition hover:bg-[#343832]" href="#contact">
                Book an appointment
              </a>
              <button type="button" className="inline-flex items-center gap-2 rounded-full border border-[#a9cf9d] bg-[#f4fbf1] px-5 py-3.5 text-[15px] font-semibold text-[#152019] transition hover:border-[#72b65b] hover:bg-[#fff]" onClick={openVoice}>
                <AudioLines size={18} /> Talk to reception
              </button>
              <button type="button" className="inline-flex items-center gap-2 rounded-full border border-[#a9cf9d] bg-[#f4fbf1] px-5 py-3.5 text-[15px] font-semibold text-[#152019] transition hover:border-[#72b65b] hover:bg-[#fff]" onClick={openChat}>
                <MessageCircle size={18} /> Chat
              </button>
            </div>
            <dl className="mt-10 grid max-w-lg grid-cols-3 border-t border-[#b9dcae] pt-6">
              {stats.map((stat) => (
                <div key={stat.label} className="flex flex-col-reverse border-l border-[#b9dcae] px-4 first:border-l-0 first:pl-0">
                  <dt className="mt-1 text-sm leading-5 text-[#3a4840]">{stat.label}</dt>
                  <dd className="text-3xl font-bold tracking-tight text-[#152019]">{stat.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="relative">
            <img
              className="aspect-[5/4] w-full rounded-[28px] object-cover shadow-[0_24px_60px_rgba(38,61,43,0.18)]"
              src="/images/brightsmile-dental-hero.png"
              alt="Dentist consulting with a patient at BrightSmile Dental Center in Islamabad"
            />
            <div className="absolute bottom-4 left-4 flex items-center gap-3 rounded-2xl bg-[#fff] px-4 py-3 shadow-[0_10px_30px_rgba(23,27,24,0.14)]">
              <Clock className="text-[#087f5b]" size={20} />
              <div>
                <p className="text-sm font-semibold text-[#171b18]">Open Monday to Friday</p>
                <p className="text-xs text-[#68726b]">9 AM to 5 PM, Islamabad</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="services" className="scroll-mt-16 bg-white py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <div className="max-w-2xl">
            <h2 className="text-3xl text-[#171b18] md:text-[2.6rem] md:leading-[1.08]">Complete dental care in one place</h2>
            <p className="mt-4 text-lg leading-8 text-[#55605a]">Pick a treatment to start a consultation request. Not sure what you need? Reception can point you to the right one.</p>
          </div>
          <div className="mt-12 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
            {serviceGroups.map((group) => (
              <div key={group.title}>
                <h3 className="text-lg text-[#171b18]">{group.title}</h3>
                <p className="mt-1 text-sm leading-5 text-[#68726b]">{group.note}</p>
                <ul className="mt-4 border-t border-[#e2ebe0]">
                  {group.items.map((item) => (
                    <li key={item.name} className="border-b border-[#e2ebe0]">
                      <button type="button" className="group flex w-full items-start justify-between gap-3 py-3.5 text-left" onClick={() => chooseService(item.name)}>
                        <span>
                          <span className="block font-semibold text-[#171b18] transition group-hover:text-[#087f5b]">{item.name}</span>
                          <span className="mt-0.5 block text-sm leading-6 text-[#68726b]">{item.text}</span>
                        </span>
                        <ArrowRight size={16} className="mt-1 shrink-0 text-[#b6c2b8] transition group-hover:translate-x-0.5 group-hover:text-[#087f5b]" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="results" className="scroll-mt-16 border-y border-emerald-100 bg-emerald-50 py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <div className="max-w-2xl">
            <h2 className="text-3xl text-[#171b18] md:text-[2.6rem] md:leading-[1.08]">Before and after</h2>
            <p className="mt-4 text-lg leading-8 text-[#55605a]">See how thoughtful treatment planning can improve smile health, balance, and confidence.</p>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {smileResults.map((result) => (
              <article key={result.title} className="overflow-hidden rounded-lg border border-emerald-100 bg-white">
                <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
                  <img className="h-full w-full object-cover" src={result.image} alt={`${result.title} illustrative before and after smile result`} />
                  <span className="absolute left-3 top-3 rounded-full bg-[#171b18]/85 px-3 py-1 text-xs font-semibold text-[#fff]">Before</span>
                  <span className="absolute bottom-3 left-3 rounded-full bg-[#087f5b] px-3 py-1 text-xs font-semibold text-[#fff]">After</span>
                </div>
                <div className="p-5">
                  <h3 className="text-xl text-[#171b18]">{result.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#55605a]">{result.description}</p>
                </div>
              </article>
            ))}
          </div>

          <p className="mt-6 text-xs leading-5 text-[#68726b]">Illustrative treatment examples. Individual needs and results vary after clinical assessment.</p>
        </div>
      </section>

      <section id="reviews" className="scroll-mt-16 bg-white py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <h2 className="max-w-xl text-3xl text-[#171b18] md:text-[2.6rem] md:leading-[1.08]">A smoother way to start dental care</h2>
            <div className="flex items-center gap-2.5 text-sm text-[#55605a]">
              <span className="flex text-[#e0a100]" aria-label="Five stars">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Star key={index} fill="currentColor" size={18} />
                ))}
              </span>
              From recent patients
            </div>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {testimonials.map((item) => (
              <figure key={item.name} className="flex flex-col justify-between rounded-2xl bg-[#f2f8ef] p-7">
                <blockquote className="text-[17px] leading-8 text-[#242a25]">“{item.text}”</blockquote>
                <figcaption className="mt-6 flex items-center gap-3 text-sm font-semibold text-[#171b18]">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#fff] text-[#087f5b]">{item.name[0]}</span>
                  {item.name}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section id="contact" className="scroll-mt-16 border-t border-[#e2ebe0] py-16 md:py-24">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 md:px-8 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          <div>
            <h2 className="text-3xl text-[#171b18] md:text-[2.6rem] md:leading-[1.08]">Request a consultation</h2>
            <p className="mt-4 text-lg leading-8 text-[#55605a]">Tell us what you need and the reception team will call you to agree a time.</p>
            <ol className="mt-8 space-y-5">
              {bookingSteps.map((step, index) => (
                <li key={step.title} className="flex gap-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#dff4d7] text-sm font-bold text-[#087f5b]">{index + 1}</span>
                  <div>
                    <p className="font-semibold text-[#171b18]">{step.title}</p>
                    <p className="mt-0.5 text-sm leading-6 text-[#68726b]">{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>
            <ul className="mt-9 space-y-3 border-t border-[#e2ebe0] pt-7 text-[15px] text-[#3a4840]">
              <li className="flex items-center gap-3"><Clock size={18} className="shrink-0 text-[#087f5b]" /> Monday to Friday, 9 AM to 5 PM</li>
              <li className="flex items-center gap-3"><Mail size={18} className="shrink-0 text-[#087f5b]" /> hello@brightsmiledentalcenter.com</li>
              <li className="flex items-center gap-3"><MapPin size={18} className="shrink-0 text-[#087f5b]" /> Islamabad, Pakistan</li>
            </ul>
          </div>

          <div>
            {submitted && (
              <div className="mb-4 flex items-start gap-3 rounded-2xl bg-[#eff8eb] p-4 text-[#087f5b]">
                <Check size={20} strokeWidth={2.5} className="mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold">We received your request.</p>
                  <p className="mt-0.5 text-sm text-[#3a4840]">Reception will call you during clinic hours to agree a time.</p>
                </div>
              </div>
            )}
            <LeadForm
              key={selectedService}
              onSubmit={handleSubmit}
              loading={loading}
              submitLabel="Request consultation"
              notesLabel="Anything we should know?"
              placeholders={{ name: "Your full name", phone: "0300 1234567", email: "you@example.com", notes: "Preferred day or time, or what is bothering you" }}
              initialValues={{
                service: selectedService,
                source: "Website Form",
                sourceDetail: "Dental clinic website form"
              }}
            />
          </div>
        </div>
      </section>

      <footer className="bg-gray-950 pb-24 pt-10 text-white md:pb-12">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 md:flex-row md:items-center md:justify-between md:px-8">
          <div>
            <p className="text-xl font-bold">BrightSmile Dental Center</p>
            <p className="mt-2 text-sm text-gray-400">Modern dental consultations and friendly follow-up care.</p>
          </div>
          <div className="flex flex-col gap-2 text-sm text-gray-300 sm:flex-row sm:gap-6 md:pr-52">
            <span>hello@brightsmiledentalcenter.com</span>
            <span>Islamabad, Pakistan</span>
            <span>Mon to Fri, 9 AM to 5 PM</span>
          </div>
        </div>
      </footer>

      <div className="fixed bottom-4 right-4 z-40 flex items-center gap-1 rounded-full border border-[#dce9d7] bg-white p-1.5 shadow-[0_10px_30px_rgba(23,27,24,0.16)] sm:bottom-5 sm:right-5">
        <LauncherButton icon={AudioLines} label="Talk" active={voiceOpen} ariaLabel={voiceOpen ? "Close voice assistant" : "Open voice assistant"} onClick={() => (voiceOpen ? handleCloseVoicePanel() : openVoice())} />
        <LauncherButton icon={MessageCircle} label="Chat" active={chatOpen} ariaLabel={chatOpen ? "Close chat" : "Open chat"} onClick={() => (chatOpen ? setChatOpen(false) : openChat())} />
      </div>

      {voiceOpen && (
        <FloatingPanel
          icon={AudioLines}
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
        <FloatingPanel
          icon={MessageCircle}
          title="Chat with the clinic"
          subtitle="Usually replies in a few seconds"
          onClose={() => setChatOpen(false)}
          action={chatMessages.length > 1 ? { icon: RotateCcw, label: "Start a new chat", onClick: resetChat } : null}
        >
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
                    <button type="button" className="rounded-full border border-[#dce9d7] bg-white px-3 py-1.5 text-[13px] font-medium text-[#263229] transition hover:border-[#8ec879] hover:bg-[#eff8eb] disabled:opacity-50" disabled={chatLoading} onClick={() => sendChatMessage("What are your clinic hours?")}>
                      Clinic hours
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

function BrandMark() {
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
      <rect width="30" height="30" rx="9" fill="#1d1f1c" />
      <path d="M8.5 13.5c1.6 4.4 4 6.4 6.5 6.4s4.9-2 6.5-6.4" fill="none" stroke="#baff98" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

function LauncherButton({ icon: Icon, label, active, ariaLabel, onClick }) {
  return (
    <button
      className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#72b65b] ${
        active ? "bg-[#1d1f1c] text-white" : "text-[#263229] hover:bg-[#eff8eb]"
      }`}
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={active}
    >
      <Icon size={18} strokeWidth={2.1} />
      {label}
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

function FloatingPanel({ icon: Icon, title, subtitle, live = false, action = null, children, onClose }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`flex flex-col overflow-hidden border-[#e2ebe0] bg-white transition-[width,transform] duration-300 ease-out ${
        expanded
          ? "fixed inset-y-0 right-0 z-50 w-[25vw] min-w-[340px] max-w-[520px] border-l shadow-[0_0_48px_rgba(23,27,24,0.16)] max-sm:w-full"
          : "fixed bottom-[5.25rem] right-4 z-40 h-[min(620px,calc(100vh-6.5rem))] w-[calc(100vw-2rem)] max-w-[420px] rounded-[20px] border shadow-[0_18px_50px_rgba(23,27,24,0.16)] sm:right-5"
      }`}
    >
      <div className="flex shrink-0 items-center gap-3 border-b border-[#edf1ea] px-4 py-3.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#dff4d7] text-[#087f5b]">
          <Icon size={19} strokeWidth={2.1} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-[#171b18]">{title}</p>
          <p className="flex items-center gap-1.5 truncate text-xs text-[#68726b]">
            {live && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#c8372d]" />}
            {subtitle}
          </p>
        </div>
        {action && (
          <button className="rounded-lg p-2 text-[#68726b] transition hover:bg-[#f3f7f0] hover:text-[#171b18]" onClick={action.onClick} aria-label={action.label} title={action.label}>
            <action.icon size={16} />
          </button>
        )}
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
