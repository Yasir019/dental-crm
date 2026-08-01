import {
  Activity,
  AlignCenter,
  ArrowRight,
  Baby,
  Bot,
  CalendarCheck,
  CircleDot,
  Crown,
  HeartHandshake,
  HeartPulse,
  Mic,
  Phone,
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
        history: nextMessages.slice(-12),
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
          <div className="space-y-3">
            <div className="rounded-xl border border-emerald-100 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${voiceCallActive ? "bg-emerald-500" : voiceConnecting ? "bg-amber-400" : "bg-gray-300"}`} />
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-500">{voiceCallActive ? "Live conversation" : voiceConnecting ? "Connecting" : "Voice assistant"}</p>
                  <p className="text-sm font-semibold text-gray-800">{voiceStatus}</p>
                </div>
              </div>
              {voiceError && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">{voiceError}</p>}
              {voiceTranscript && (
                <div className="mt-3 max-h-64 space-y-3 overflow-y-auto rounded-xl border border-gray-100 bg-gray-50 p-3">
                  {parseConversationTranscript(voiceTranscript).map((message, index) => (
                    <ConversationMessage key={`${message.role}-${index}`} {...message} compact />
                  ))}
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
          </div>
        </FloatingPanel>
      )}

      {chatOpen && (
        <FloatingPanel title="Dental Chat Assistant" onClose={() => setChatOpen(false)}>
          <form className="space-y-3" onSubmit={handleChatSubmit}>
            <div className="h-80 space-y-3 overflow-y-auto rounded-lg bg-gray-50 p-3">
              {chatMessages.map((message, index) => (
                <ConversationMessage key={`${message.role}-${index}`} role={message.role} content={message.content} compact />
              ))}
              {chatLoading && (
                <ConversationMessage content="Thinking..." compact />
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
