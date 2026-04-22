import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, Play, Pause, Volume2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import WaveformVisualizer from "./WaveformVisualizer";

const API_URL = "https://voicesync-wv9b.onrender.com/convert";

const VOICES = [
  { value: "alloy", label: "Alloy — Neutral" },
  { value: "echo", label: "Echo — Warm Male" },
  { value: "fable", label: "Fable — British" },
  { value: "onyx", label: "Onyx — Deep Male" },
  { value: "nova", label: "Nova — Bright Female" },
  { value: "shimmer", label: "Shimmer — Soft Female" },
];

const VoiceSync = () => {
  const [text, setText] = useState("");
  const [voice, setVoice] = useState("alloy");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [rate, setRate] = useState(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const handleGenerate = useCallback(async () => {
    if (!text.trim()) return;
    setIsGenerating(true);

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice }),
      });

      if (!res.ok) throw new Error(`Request failed: ${res.status}`);

      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("audio")) {
        // Backend returned JSON (likely an error) instead of audio
        const errBody = await res.json().catch(() => null);
        const message =
          errBody?.detail?.message ||
          errBody?.detail ||
          errBody?.error ||
          "Backend did not return audio.";
        throw new Error(typeof message === "string" ? message : JSON.stringify(message));
      }

      const blob = await res.blob();
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);

      // Auto-play once loaded
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.playbackRate = rate;
          audioRef.current.play().catch(() => {});
        }
      }, 50);
    } catch (err) {
      console.error(err);
      toast({
        title: "Generation failed",
        description: err instanceof Error ? err.message : "Could not reach the backend.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  }, [text, voice, rate, audioUrl, toast]);

  const togglePlayback = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      a.playbackRate = rate;
      a.play();
    } else {
      a.pause();
    }
  };

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = rate;
  }, [rate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 mb-4">
          <div className="p-2 rounded-lg bg-primary/10 glow-border">
            <Mic className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-4xl font-bold gradient-text">VoiceSync</h1>
        </div>
        <p className="text-muted-foreground text-lg">
          Transform your text into natural speech
        </p>
      </div>

      <div className="w-full max-w-2xl glass-card p-6 space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">
            Enter your text
          </label>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type or paste your text here..."
            className="min-h-[140px] bg-muted/50 border-border focus:border-primary resize-none text-foreground placeholder:text-muted-foreground"
          />
          <p className="text-xs text-muted-foreground text-right">
            {text.length} characters
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">
            Voice
          </label>
          <Select value={voice} onValueChange={setVoice}>
            <SelectTrigger className="bg-muted/50 border-border focus:border-primary text-foreground">
              <SelectValue placeholder="Select a voice" />
            </SelectTrigger>
            <SelectContent>
              {VOICES.map((v) => (
                <SelectItem key={v.value} value={v.value}>
                  {v.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">
            Speed: {rate.toFixed(1)}x
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
          onClick={handleGenerate}
          disabled={!text.trim() || isGenerating}
          className="w-full h-12 text-base font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all glow-border disabled:opacity-40 disabled:shadow-none"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Volume2 className="w-5 h-5 mr-2" />
              Generate Speech
            </>
          )}
        </Button>

        {(audioUrl || isGenerating) && (
          <div className="glass-card p-5 space-y-4 border-primary/20">
            <WaveformVisualizer isPlaying={isPlaying} />

            {audioUrl && (
              <audio
                ref={audioRef}
                src={audioUrl}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
                className="w-full"
                controls
              />
            )}

            <div className="flex items-center justify-center">
              <button
                onClick={togglePlayback}
                disabled={!audioUrl}
                className="w-14 h-14 rounded-full flex items-center justify-center bg-primary text-primary-foreground hover:bg-primary/90 transition-all glow-border disabled:opacity-40"
              >
                {isPlaying ? (
                  <Pause className="w-6 h-6" />
                ) : (
                  <Play className="w-6 h-6 ml-0.5" />
                )}
              </button>
            </div>

            <p className="text-center text-sm text-muted-foreground">
              {isGenerating ? "Generating..." : isPlaying ? "Playing..." : "Ready to play"}
            </p>
          </div>
        )}
      </div>

      <p className="mt-8 text-sm text-muted-foreground">
        Powered by VoiceSync API
      </p>
    </div>
  );
};

export default VoiceSync;
