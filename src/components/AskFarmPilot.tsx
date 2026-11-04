"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, Loader2, Mic, Send, Sparkles, Square, Wrench } from "lucide-react";
import type { AgentReply, ChatTurn } from "@/lib/agent";
import type { Farm } from "@/lib/types";
import { toWav16k } from "@/lib/wav";

export interface ChatMessage extends ChatTurn {
  tools?: string[];
  sources?: AgentReply["sources"];
  voice?: boolean;
}

const SUGGESTIONS = [
  "When should I apply urea, and how much?",
  "What should I do on my farm this week?",
  "How much would 0.5 hectares of maize cost?",
  "My maize leaves have holes and sawdust in the funnel. What is it?",
  "Is it better to sell my grain at harvest or store it?",
];

/** Render **bold** and line breaks from the model's simple markdown. */
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, i) => (
        <p key={i} className={line.trim() === "" ? "h-2" : line.trim().startsWith("*") || line.trim().startsWith("-") ? "pl-4 -indent-3" : ""}>
          {line
            .replace(/^\s*[*-]\s+/, "• ")
            .split(/(\*\*[^*]+\*\*)/)
            .map((part, j) => (part.startsWith("**") ? <b key={j}>{part.slice(2, -2)}</b> : part))}
        </p>
      ))}
    </>
  );
}

export default function AskFarmPilot({ farm, messages, setMessages }: { farm: Farm; messages: ChatMessage[]; setMessages: (m: ChatMessage[]) => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Newer browsers return a Promise from scrollIntoView, so don't return it as a cleanup.
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  async function send(content: string, voice = false) {
    const q = content.trim();
    if (!q || busy) return;
    setError(null);
    const next: ChatMessage[] = [...messages, { role: "user", content: q, voice }];
    setMessages(next);
    setText("");
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ farm, messages: next.map(({ role, content }) => ({ role, content })) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "FarmPilot couldn't answer");
      setMessages([...next, { role: "assistant", content: data.answer, tools: data.tools, sources: data.sources }]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunks.current = [];
      rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setTranscribing(true);
        try {
          const wav = await toWav16k(new Blob(chunks.current, { type: rec.mimeType }));
          const res = await fetch("/api/transcribe", { method: "POST", headers: { "Content-Type": "audio/wav" }, body: wav });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? "Couldn't understand the recording");
          if (data.transcript?.trim()) await send(data.transcript, true);
          else setError("I didn't catch that. Please try again, a little closer to the phone.");
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setTranscribing(false);
        }
      };
      rec.start();
      recorder.current = rec;
      setRecording(true);
    } catch {
      setError("Microphone not available. Allow microphone access, or type your question.");
    }
  }

  function stopRecording() {
    recorder.current?.stop();
    recorder.current = null;
    setRecording(false);
  }

  return (
    <section className="mx-auto flex max-w-3xl flex-col rounded-3xl border border-line bg-white">
      <div className="border-b border-line p-5">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Sparkles className="h-5 w-5 text-leaf-600" /> Ask FarmPilot
        </h2>
        <p className="text-sm text-muted">
          Ask anything about your farm, by typing or with your voice. Muse Spark answers from your own farm data, plan and prices, and searches the web for the rest.
        </p>
      </div>

      <div className="min-h-[320px] space-y-4 p-5">
        {!messages.length && (
          <div>
            <p className="text-sm font-semibold text-muted">Try asking:</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)} className="rounded-full border border-line px-3 py-1.5 text-left text-sm hover:border-leaf-500 hover:bg-leaf-50">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <p className="max-w-[85%] rounded-2xl rounded-br-md bg-leaf-600 px-4 py-2.5 text-white">
                {m.voice && <Mic className="mr-1.5 inline h-3.5 w-3.5 opacity-80" />}
                {m.content}
              </p>
            </div>
          ) : (
            <div key={i} className="flex gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-leaf-600 text-sm text-white">🌱</span>
              <div className="min-w-0 max-w-[85%] space-y-1 rounded-2xl rounded-tl-md bg-canvas px-4 py-3 text-[15px] leading-relaxed">
                <Rich text={m.content} />
                {!!m.tools?.length && (
                  <p className="flex flex-wrap items-center gap-1 pt-2 text-xs text-muted">
                    <Wrench className="h-3 w-3" /> Checked {m.tools.join(", ")}
                  </p>
                )}
                {!!m.sources?.length && (
                  <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                    {m.sources.map((s) => (
                      <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-leaf-700 hover:underline">
                        <ExternalLink className="h-3 w-3" /> {s.title}
                      </a>
                    ))}
                  </p>
                )}
              </div>
            </div>
          ),
        )}

        {busy && (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> FarmPilot is checking your farm data…
          </p>
        )}
        {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
        className="sticky bottom-0 flex items-center gap-2 rounded-b-3xl border-t border-line bg-white p-3"
      >
        <button
          type="button"
          onClick={recording ? stopRecording : startRecording}
          disabled={busy || transcribing}
          title={recording ? "Stop and send" : "Ask with your voice"}
          className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white disabled:opacity-50 ${recording ? "animate-pulse bg-red-500" : "bg-sky-500 hover:bg-sky-600"}`}
        >
          {transcribing ? <Loader2 className="h-5 w-5 animate-spin" /> : recording ? <Square className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </button>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={recording ? "Listening… tap the red button when you finish" : transcribing ? "Muse Voice Transcribe is listening back…" : "Type your question…"}
          disabled={recording || transcribing}
          className="min-w-0 flex-1 rounded-2xl border border-line px-4 py-3 outline-none focus:border-leaf-500"
        />
        <button type="submit" disabled={!text.trim() || busy} className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-leaf-600 text-white disabled:opacity-40">
          <Send className="h-5 w-5" />
        </button>
      </form>
    </section>
  );
}
