import { useState, useRef, useCallback, useEffect } from "react";
import { Play, Pause, Volume2, Loader2, Download, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { VOICES, DEFAULT_VOICE_ID } from "@/lib/voices";
import { cn } from "@/lib/utils";
import WaveformVisualizer from "./WaveformVisualizer";

const MAX_CHARS = 5000;

const VoiceSync = () => {
  const [text, setText] = useState("");
  const [voiceId, setVoiceId] = useState(DEFAULT_VOICE_ID);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [rate, setRate] = useState(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = rate;
  }, [rate]);

  const handleGenerate = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (trimmed.length > MAX_CHARS) {
      toast({ title: "Text too long", description: `Keep it under ${MAX_CHARS} characters.`, variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("text-to-speech", {
        body: { text: trimmed, voiceId },
      });

      if (error) throw new Error(error.message || "Generation failed");
      if (!data?.audioUrl) throw new Error("No audio returned");

      setAudioUrl(data.audioUrl);
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.playbackRate = rate;
          audioRef.current.play().catch(() => {});
        }
      }, 50);

      toast({
        title: "Audio generated",
        description: `${data.voiceName}${data.provider === "lovable_ai" ? " · backup engine" : ""}`,
      });
    } catch (err) {
      console.error(err);
      toast({
        title: "Generation failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  }, [text, voiceId, rate, toast]);

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

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">
      <div className="text-center space-y-3">
        <h1 className="text-4xl md:text-5xl font-bold gradient-text">Transform text into voice</h1>
        <p className="text-muted-foreground text-lg">
          Studio-quality AI speech synthesis powered by ElevenLabs
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
          onClick={handleGenerate}
          disabled={!text.trim() || isGenerating}
          className="w-full h-12 text-base font-semibold glow-border"
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
                className="hidden"
              />
            )}

            <div className="flex items-center justify-center gap-3">
              <button
                onClick={togglePlayback}
                disabled={!audioUrl}
                className="w-14 h-14 rounded-full flex items-center justify-center bg-primary text-primary-foreground hover:bg-primary/90 transition-all glow-border disabled:opacity-40"
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
              </button>
              <Button variant="outline" size="sm" onClick={downloadAudio} disabled={!audioUrl}>
                <Download className="w-4 h-4 mr-2" />
                Download MP3
              </Button>
            </div>

            <p className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1">
              <Save className="w-3 h-3" />
              Saved to your history automatically
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default VoiceSync;
