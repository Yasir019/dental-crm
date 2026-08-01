import { Bot, UserRound } from "lucide-react";

const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const phonePattern = /(?:\+?\d[\d\s().-]{7,}\d)/g;
const namePattern = /\b(?:my name is|name is|this is)\s+([A-Za-z][A-Za-z'-]*(?:\s+[A-Za-z][A-Za-z'-]*){0,2})/i;

export function parseConversationLine(line) {
  const value = String(line || "").trim();
  const match = value.match(/^(user|caller|agent|assistant|ai)\s*:\s*(.*)$/i);
  if (!match) return { role: "assistant", content: value };
  const speaker = match[1].toLowerCase();
  return {
    role: ["user", "caller"].includes(speaker) ? "user" : "assistant",
    content: match[2].trim(),
  };
}

export function parseConversationTranscript(transcript) {
  const value = String(transcript || "").replace(/\r/g, " ").trim();
  if (!value) return [];

  // Retell may return several speaker turns in one string without newlines.
  const turns = value
    .split(/(?=(?:user|caller|agent|assistant|ai)\s*:)/i)
    .map((turn) => turn.trim())
    .filter(Boolean);

  return turns.length ? turns.map(parseConversationLine) : [parseConversationLine(value)];
}

export function renderContactHighlights(text) {
  const value = String(text || "");
  const matches = [];
  const addMatches = (pattern, type) => {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(value))) {
      const start = type === "name" ? match.index + match[0].lastIndexOf(match[1]) : match.index;
      const highlighted = type === "name" ? match[1] : match[0];
      matches.push({ start, end: start + highlighted.length, value: highlighted, type });
      if (pattern.lastIndex === match.index) pattern.lastIndex += 1;
    }
  };

  addMatches(emailPattern, "email");
  addMatches(phonePattern, "phone");
  const nameMatch = value.match(namePattern);
  if (nameMatch) {
    const start = nameMatch.index + nameMatch[0].lastIndexOf(nameMatch[1]);
    matches.push({ start, end: start + nameMatch[1].length, value: nameMatch[1], type: "name" });
  }

  const uniqueMatches = matches
    .sort((a, b) => a.start - b.start)
    .filter((match, index, list) => index === 0 || match.start >= list[index - 1].end);
  if (!uniqueMatches.length) return value;

  const fragments = [];
  let cursor = 0;
  uniqueMatches.forEach((match) => {
    if (match.start > cursor) fragments.push(value.slice(cursor, match.start));
    fragments.push(
      <mark key={`${match.type}-${match.start}`} className="rounded-md bg-emerald-200 px-1.5 py-0.5 font-semibold text-emerald-950 ring-1 ring-emerald-300">
        {match.value}
      </mark>,
    );
    cursor = match.end;
  });
  if (cursor < value.length) fragments.push(value.slice(cursor));
  return fragments;
}

export default function ConversationMessage({ role = "assistant", content, compact = false, flat = false }) {
  const isUser = role === "user";
  if (flat) {
    return (
      <div className={`flex items-start gap-2.5 ${isUser ? "justify-end" : "justify-start"}`}>
        <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${isUser ? "bg-emerald-100 text-emerald-700" : "bg-gray-900 text-white"}`}>
          {isUser ? <UserRound size={12} /> : <Bot size={12} />}
        </div>
        <div className={`min-w-0 max-w-[88%] ${isUser ? "text-right" : "text-left"}`}>
          <p className={`mb-0.5 text-[10px] font-bold uppercase tracking-wide ${isUser ? "text-emerald-700" : "text-gray-500"}`}>
            {isUser ? "You" : "AI Receptionist"}
          </p>
          <p className="text-sm leading-6 text-gray-700">{renderContactHighlights(content)}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`flex max-w-[88%] items-end gap-2 ${isUser ? "flex-row-reverse" : ""}`}>
        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${isUser ? "bg-emerald-100 text-emerald-700" : "bg-gray-900 text-white"}`}>
          {isUser ? <UserRound size={14} /> : <Bot size={14} />}
        </div>
        <div>
          <p className={`mb-1 text-[11px] font-bold uppercase tracking-wide ${isUser ? "text-right text-emerald-700" : "text-gray-500"}`}>
            {isUser ? "You" : "AI Receptionist"}
          </p>
          <div className={`rounded-2xl px-3.5 py-2.5 text-sm leading-6 shadow-sm ${compact ? "rounded-xl" : ""} ${isUser ? "rounded-br-md bg-emerald-600 text-white" : "rounded-bl-md border border-gray-200 bg-white text-gray-700"}`}>
            {renderContactHighlights(content)}
          </div>
        </div>
      </div>
    </div>
  );
}
