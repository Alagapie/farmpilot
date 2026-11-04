"use client";

import { useRef, useState } from "react";
import { toWav16k } from "./wav";

/** Record from the microphone and transcribe with Muse Voice Transcribe. */
export function useVoice(onText: (text: string) => void, onError: (message: string) => void) {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setTranscribing(true);
        try {
          const wav = await toWav16k(new Blob(chunks, { type: rec.mimeType }));
          const res = await fetch("/api/transcribe", { method: "POST", headers: { "Content-Type": "audio/wav" }, body: wav });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? "Couldn't understand the recording");
          if (data.transcript?.trim()) onText(data.transcript.trim());
          else onError("I didn't catch that. Please try again, a little closer to the phone.");
        } catch (err) {
          onError((err as Error).message);
        } finally {
          setTranscribing(false);
        }
      };
      rec.start();
      recorder.current = rec;
      setRecording(true);
    } catch {
      onError("Microphone not available. Allow microphone access, or type instead.");
    }
  }

  function stop() {
    recorder.current?.stop();
    recorder.current = null;
    setRecording(false);
  }

  return { recording, transcribing, start, stop };
}
