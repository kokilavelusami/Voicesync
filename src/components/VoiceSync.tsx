import { useState, useRef, useCallback, useEffect } from "react";
import { Play, Pause, Volume2, Loader2, Download, Sparkles, Globe, Wand2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { VOICES, DEFAULT_VOICE_ID } from "@/lib/voices";
import { cn } from "@/lib/utils";
import {
  speak as browserSpeak,
  stopSpeaking,
  isBrowserTTSAvailable,
} from "@/lib/browserTTS";
import WaveformVisualizer from "./WaveformVisualizer";

const MAX_CHARS = 5000;
type Engine = "browser" | "elevenlabs";

const VoiceSync = () => {
  const [text, setText] = useState("");
  const [topic, setTopic] = useState("");
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [voiceId, setVoiceId] = useState(DEFAULT_VOICE_ID);
  const [engine, setEngine] = useState<Engine>("browser");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [activeEngine, setActiveEngine] = useState<Engine | null>(null);
  const [rate, setRate] = useState(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { toast } = useToast();

  const generateScript = useCallback(async () => {
    const t = topic.trim();
    if (!t) {
      toast({ title: "Enter a podcast topic first", variant: "destructive" });
      return;
    }

    // Mixed-content guard: browsers block http://localhost requests from an https page.
    if (typeof window !== "undefined" && window.location.protocol === "https:") {
      console.error(
        "[Ollama] Page is HTTPS but Ollama runs on http://localhost:11434. " +
        "Browsers block this as mixed content. Run the app locally (npm run dev) to use Generate Script.",
      );
      toast({
        title: "Can't reach Ollama from the hosted preview",
        description:
          "Ollama is http://localhost only; browsers block it from https pages. Run the app locally (npm run dev) and open http://localhost:8080.",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingScript(true);
    const prompt = `Create a professional podcast script about ${t}. Include an engaging introduction, explanation of key concepts, practical examples, and a conclusion. Output ONLY the spoken script text — no headings, no stage directions, no markdown.`;
    console.log("[Ollama] POST http://localhost:11434/api/generate", { model: "llama3", topic: t });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120_000);

    try {
      const res = await fetch("http://localhost:11434/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "llama3", prompt, stream: false }),
        signal: controller.signal,
      });

      console.log("[Ollama] status", res.status);

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        console.error("[Ollama] error body:", errText);
        if (res.status === 404 || /model.*not found/i.test(errText)) {
          toast({
            title: "Model 'llama3' not installed",
            description: "Run: ollama pull llama3",
            variant: "destructive",
          });
        } else if (res.status === 403) {
          toast({
            title: "Ollama blocked the request (CORS)",
            description: "Restart Ollama with: OLLAMA_ORIGINS='*' ollama serve",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Unable to generate script",
            description: `Ollama responded ${res.status}. ${errText.slice(0, 120)}`,
            variant: "destructive",
          });
        }
        return;
      }

      const data = await res.json();
      console.log("[Ollama] response", data);
      const script = (data?.response ?? "").trim();
      if (!script) {
        toast({ title: "Empty response from Ollama", variant: "destructive" });
        return;
      }
      setText(script);
      toast({ title: "Script generated", description: "You can edit it before generating audio." });
    } catch (err: unknown) {
      console.error("[Ollama] fetch failed:", err);
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes("abort")) {
        toast({
          title: "Ollama timed out",
          description: "The model took too long. Try a shorter topic or a smaller model.",
          variant: "destructive",
        });
      } else if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
        toast({
          title: "Ollama server is not running",
          description: "Start it with: OLLAMA_ORIGINS='*' ollama serve  (and: ollama pull llama3)",
          variant: "destructive",
        });
      } else {
        toast({ title: "Unable to generate script", description: msg, variant: "destructive" });
      }
    } finally {
      clearTimeout(timeoutId);
      setIsGeneratingScript(false);
    }
  }, [topic, toast]);


  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = rate;
  }, [rate]);

  useEffect(() => {
    return () => {
      stopSpeaking();
      audioRef.current?.pause();
    };
  }, []);

  const playWithBrowser = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (!isBrowserTTSAvailable()) {
      toast({ title: "Browser voice not supported", variant: "destructive" });
      return;
    }
    setActiveEngine("browser");
    setAudioUrl(null);
    audioRef.current?.pause();

    try {
      await browserSpeak({
        text: trimmed,
        voiceId,
        rate,
        onStart: () => setIsPlaying(true),
        onEnd: () => setIsPlaying(false),
        onError: () => {
          setIsPlaying(false);
          toast({ title: "Playback error", variant: "destructive" });
        },
      });
    } catch {
      setIsPlaying(false);
    }
  }, [text, voiceId, rate, toast]);

  const generateWithElevenLabs = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (trimmed.length > MAX_CHARS) {
      toast({ title: "Text too long", description: `Keep it under ${MAX_CHARS} characters.`, variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    stopSpeaking();
    try {
      const { data, error } = await supabase.functions.invoke("text-to-speech", {
        body: { text: trimmed, voiceId },
      });

      if (error) throw new Error(error.message || "Generation failed");

      if (data?.code === "premium_unavailable" || !data?.audioUrl) {
        toast({
          title: "Premium engine offline",
          description: "Switched to browser voice for this clip.",
        });
        setEngine("browser");
        await playWithBrowser();
        return;
      }

      setActiveEngine("elevenlabs");
      setAudioUrl(data.audioUrl);
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.playbackRate = rate;
          audioRef.current.play().catch(() => {});
        }
      }, 50);

      toast({ title: "Premium audio ready", description: data.voiceName });
    } catch (err) {
      console.error(err);
      toast({
        title: "Premium engine unavailable",
        description: "Falling back to browser voice.",
      });
      setEngine("browser");
      await playWithBrowser();
    } finally {
      setIsGenerating(false);
    }
  }, [text, voiceId, rate, toast, playWithBrowser]);

  const handleAction = useCallback(() => {
    if (engine === "elevenlabs") generateWithElevenLabs();
    else playWithBrowser();
  }, [engine, generateWithElevenLabs, playWithBrowser]);

  const togglePlayback = () => {
    if (activeEngine === "browser") {
      if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
        window.speechSynthesis.pause();
        setIsPlaying(false);
      } else if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
        setIsPlaying(true);
      } else {
        playWithBrowser();
      }
      return;
    }
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      a.playbackRate = rate;
      a.play();
    } else {
      a.pause();
    }
  };

  const downloadAudio = async () => {
    if (!audioUrl) return;
    try {
      const res = await fetch(audioUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `voicesync-${Date.now()}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Download failed", variant: "destructive" });
    }
  };

  const showOutput = isGenerating || isPlaying || audioUrl;

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">
      <div className="text-center space-y-3">
        <h1 className="text-4xl md:text-5xl font-bold gradient-text">Transform text into voice</h1>
        <p className="text-muted-foreground text-lg">
          Instant browser playback, with optional studio-quality AI generation
        </p>
      </div>

      <div className="glass-card p-6 space-y-6">
        <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-muted/30 border border-border">
          <div className="flex items-center gap-3 min-w-0">
            {engine === "elevenlabs" ? (
              <Sparkles className="w-5 h-5 text-primary flex-shrink-0" />
            ) : (
              <Globe className="w-5 h-5 text-primary flex-shrink-0" />
            )}
            <div className="min-w-0">
              <div className="text-sm font-semibold">
                {engine === "elevenlabs" ? "Premium AI engine" : "Instant browser engine"}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {engine === "elevenlabs"
                  ? "ElevenLabs · saved to history"
                  : "Web Speech API · works offline, no quota"}
              </div>
            </div>
          </div>
          <Switch
            checked={engine === "elevenlabs"}
            onCheckedChange={(v) => setEngine(v ? "elevenlabs" : "browser")}
            aria-label="Toggle premium engine"
          />
        </div>

        <div className="space-y-2 p-4 rounded-lg bg-muted/20 border border-border">
          <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-primary" />
            Podcast Topic
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. The future of AI in everyday life"
              className="bg-muted/40 border-border focus:border-primary"
              disabled={isGeneratingScript}
            />
            <Button
              onClick={generateScript}
              disabled={!topic.trim() || isGeneratingScript}
              variant="outline"
              className="sm:w-auto"
            >
              {isGeneratingScript ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4 mr-2" />
                  Generate Script
                </>
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Uses your local Ollama (llama3). Run <code className="px-1 rounded bg-muted">ollama serve</code> and edit the script below before generating audio.
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-muted-foreground">Your text</label>
            <span className={cn("text-xs", text.length > MAX_CHARS ? "text-destructive" : "text-muted-foreground")}>
              {text.length} / {MAX_CHARS}
            </span>
          </div>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type or paste your text here, or generate a script from a topic above..."
            className="min-h-[140px] bg-muted/40 border-border focus:border-primary resize-none"
          />
        </div>

        <div className="space-y-3">
          <label className="text-sm font-medium text-muted-foreground">Choose a voice</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {VOICES.map((v) => {
              const selected = v.id === voiceId;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setVoiceId(v.id)}
                  className={cn(
                    "text-left p-3 rounded-lg border transition-all",
                    selected
                      ? "border-primary bg-primary/10 glow-border"
                      : "border-border bg-muted/30 hover:border-primary/40 hover:bg-muted/60",
                  )}
                >
                  <div className="font-semibold text-sm">{v.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{v.description}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mt-1">
                    {v.accent}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">
            Playback speed: {rate.toFixed(1)}x
          </label>
          <Slider
            value={[rate]}
            onValueChange={([v]) => setRate(v)}
            min={0.5}
            max={2}
            step={0.1}
            className="mt-3"
          />
        </div>

        <Button
          onClick={handleAction}
          disabled={!text.trim() || isGenerating}
          className="w-full h-12 text-base font-semibold glow-border"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Generating premium audio...
            </>
          ) : (
            <>
              <Volume2 className="w-5 h-5 mr-2" />
              {engine === "elevenlabs" ? "Generate Premium Audio" : "Speak Now"}
            </>
          )}
        </Button>

        {showOutput && (
          <div className="glass-card p-5 space-y-4 border-primary/20">
            <WaveformVisualizer isPlaying={isPlaying} />

            {audioUrl && (
              <audio
                ref={audioRef}
                src={audioUrl}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
                className="hidden"
              />
            )}

            <div className="flex items-center justify-center gap-3">
              <button
                onClick={togglePlayback}
                className="w-14 h-14 rounded-full flex items-center justify-center bg-primary text-primary-foreground hover:bg-primary/90 transition-all glow-border"
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
              </button>
              {audioUrl && (
                <Button variant="outline" size="sm" onClick={downloadAudio}>
                  <Download className="w-4 h-4 mr-2" />
                  Download MP3
                </Button>
              )}
            </div>

            <p className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5">
              {activeEngine === "elevenlabs" ? (
                <>
                  <Sparkles className="w-3 h-3" />
                  Premium clip · saved to your history
                </>
              ) : (
                <>
                  <Globe className="w-3 h-3" />
                  Browser playback · enable Premium to save to history
                </>
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default VoiceSync;
