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
      <mark key={`${match.type}-${match.start}`} className="bg-transparent font-semibold text-inherit underline decoration-[#72b65b] decoration-2 underline-offset-[3px]">
        {match.value}
      </mark>,
    );
    cursor = match.end;
  });
  if (cursor < value.length) fragments.push(value.slice(cursor));
  return fragments;
}

function renderInline(text) {
  // AI replies sometimes carry **bold** markers; show the emphasis, not the asterisks.
  return String(text)
    .split(/\*\*(.+?)\*\*/g)
    .map((part, index) => (index % 2 ? <strong key={index} className="font-semibold">{renderContactHighlights(part)}</strong> : <span key={index}>{renderContactHighlights(part)}</span>));
}

function renderMessageBody(content) {
  const blocks = [];
  String(content || "")
    .split("\n")
    .forEach((line) => {
      const bullet = line.match(/^\s*[-•*]\s+(.*)$/);
      const last = blocks[blocks.length - 1];
      if (bullet) {
        if (last?.type === "list") last.items.push(bullet[1]);
        else blocks.push({ type: "list", items: [bullet[1]] });
      } else if (line.trim()) {
        blocks.push({ type: "text", text: line.trim() });
      }
    });

  return blocks.map((block, index) =>
    block.type === "list" ? (
      <ul key={index} className="my-1.5 space-y-0.5">
        {block.items.map((item, itemIndex) => (
          <li key={itemIndex} className="flex gap-2">
            <span className="mt-[0.6rem] h-1 w-1 shrink-0 rounded-full bg-current opacity-50" />
            <span>{renderInline(item)}</span>
          </li>
        ))}
      </ul>
    ) : (
      <p key={index} className={index ? "mt-1.5" : ""}>{renderInline(block.text)}</p>
    ),
  );
}

export default function ConversationMessage({ role = "assistant", content, typing = false, speakerLabel = false }) {
  const isUser = role === "user";
  return (
    <div className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
      {speakerLabel && <p className="mb-1 px-1 text-xs font-medium text-[#68726b]">{isUser ? "Patient" : "Receptionist"}</p>}
      <div
        className={`max-w-[85%] break-words px-3.5 py-2.5 text-sm leading-6 ${
          isUser ? "rounded-[18px] rounded-br-md bg-[#1d1f1c] text-white" : "rounded-[18px] rounded-bl-md bg-[#f1f6ee] text-[#242a25]"
        }`}
      >
        {typing ? (
          <span className="typing-dots flex h-6 items-center gap-1" role="status" aria-label="Writing a reply">
            <span />
            <span />
            <span />
          </span>
        ) : (
          renderMessageBody(content)
        )}
      </div>
    </div>
  );
}