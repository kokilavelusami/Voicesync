import { useState, useRef, useCallback, useEffect } from "react";
import { Play, Pause, Volume2, Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
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
  const [voiceId, setVoiceId] = useState(DEFAULT_VOICE_ID);
  const [engine, setEngine] = useState<Engine>("browser");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [activeEngine, setActiveEngine] = useState<Engine | null>(null);
  const [rate, setRate] = useState(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { toast } = useToast();



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

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        await supabase.from("generations").insert({
          user_id: user.id,
          text: trimmed,
          voice_id: voiceId,
          voice_name: data.voiceName,
          audio_path: data.audioPath,
          character_count: trimmed.length,
        });
      }

      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.playbackRate = rate;
          audioRef.current.play().catch(() => { });
        }
      }, 50);

      toast({
        title: "Premium audio ready",
        description: data.voiceName,
      });

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
          Turn your ideas into clear, natural voice recordings.
        </p>
      </div>

      <div className="glass-card p-6 space-y-6">
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
            placeholder="Type or paste your text here..."
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
               Generate Audio
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
          </div>
        )}
      </div>
    </div>
  );
};

export default VoiceSync;