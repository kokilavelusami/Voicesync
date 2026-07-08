// Browser Web Speech API wrapper. Always-available TTS fallback.

import { VOICES } from "./voices";

export interface BrowserVoiceMatch {
  voice: SpeechSynthesisVoice | null;
  lang: string;
}

const ACCENT_TO_LANG: Record<string, string> = {
  American: "en-US",
  British: "en-GB",
  Australian: "en-AU",
  Swedish: "sv-SE",
};

function femaleHint(name: string) {
  return ["Aria", "Sarah", "Laura", "Alice", "Lily", "Charlotte"].includes(name);
}

export function pickBrowserVoice(voiceId: string): BrowserVoiceMatch {
  const meta = VOICES.find((v) => v.id === voiceId);
  const lang = (meta && ACCENT_TO_LANG[meta.accent]) || "en-US";
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return { voice: null, lang };

  const langMatches = voices.filter((v) => v.lang === lang);
  const pool = langMatches.length ? langMatches : voices.filter((v) => v.lang.startsWith("en"));
  if (!pool.length) return { voice: voices[0], lang };

  const wantFemale = meta ? femaleHint(meta.name) : true;
  const gendered = pool.find((v) =>
    wantFemale
      ? /female|woman|samantha|victoria|karen|tessa|fiona|zira|google uk english female/i.test(v.name)
      : /male|man|daniel|alex|fred|google uk english male/i.test(v.name),
  );
  return { voice: gendered ?? pool[0], lang };
}

export function ensureVoicesLoaded(): Promise<void> {
  return new Promise((resolve) => {
    const existing = window.speechSynthesis.getVoices();
    if (existing.length) return resolve();
    const handler = () => {
      window.speechSynthesis.removeEventListener("voiceschanged", handler);
      resolve();
    };
    window.speechSynthesis.addEventListener("voiceschanged", handler);
    setTimeout(resolve, 500);
  });
}

export interface SpeakOptions {
  text: string;
  voiceId: string;
  rate?: number;
  pitch?: number;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: SpeechSynthesisErrorEvent) => void;
}

export async function speak({
  text,
  voiceId,
  rate = 1,
  pitch = 1,
  onStart,
  onEnd,
  onError,
}: SpeakOptions): Promise<SpeechSynthesisUtterance> {
  await ensureVoicesLoaded();
  window.speechSynthesis.cancel();

  const utter = new SpeechSynthesisUtterance(text);
  const { voice, lang } = pickBrowserVoice(voiceId);
  if (voice) utter.voice = voice;
  utter.lang = lang;
  utter.rate = rate;
  utter.pitch = pitch;
  utter.onstart = () => onStart?.();
  utter.onend = () => onEnd?.();
  utter.onerror = (e) => onError?.(e);
  window.speechSynthesis.speak(utter);
  return utter;
}

export function stopSpeaking() {
  window.speechSynthesis.cancel();
}

export function pauseSpeaking() {
  window.speechSynthesis.pause();
}

export function resumeSpeaking() {
  window.speechSynthesis.resume();
}

export const isBrowserTTSAvailable = () =>
  typeof window !== "undefined" && "speechSynthesis" in window;
