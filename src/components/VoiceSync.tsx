import { useState, useEffect, useRef, useCallback } from "react";
import { Mic, Play, Pause, Volume2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import WaveformVisualizer from "./WaveformVisualizer";

const VoiceSync = () => {
  const [text, setText] = useState("");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [rate, setRate] = useState(1);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    const loadVoices = () => {
      const available = speechSynthesis.getVoices();
      if (available.length > 0) {
        setVoices(available);
        const english = available.find((v) => v.lang.startsWith("en"));
        setSelectedVoice((english || available[0]).name);
      }
    };
    loadVoices();
    speechSynthesis.onvoiceschanged = loadVoices;
    return () => { speechSynthesis.onvoiceschanged = null; };
  }, []);

  const handleGenerate = useCallback(() => {
    if (!text.trim()) return;
    speechSynthesis.cancel();

    setIsGenerating(true);
    setTimeout(() => {
      const utterance = new SpeechSynthesisUtterance(text);
      const voice = voices.find((v) => v.name === selectedVoice);
      if (voice) utterance.voice = voice;
      utterance.rate = rate;

      utterance.onstart = () => {
        setIsGenerating(false);
        setIsPlaying(true);
        setHasGenerated(true);
      };
      utterance.onend = () => setIsPlaying(false);
      utterance.onerror = () => {
        setIsGenerating(false);
        setIsPlaying(false);
      };

      utteranceRef.current = utterance;
      speechSynthesis.speak(utterance);
    }, 600);
  }, [text, selectedVoice, voices, rate]);

  const togglePlayback = () => {
    if (isPlaying) {
      speechSynthesis.pause();
      setIsPlaying(false);
    } else if (speechSynthesis.paused) {
      speechSynthesis.resume();
      setIsPlaying(true);
    } else {
      handleGenerate();
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      {/* Header */}
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

      {/* Main Card */}
      <div className="w-full max-w-2xl glass-card p-6 space-y-6">
        {/* Text Input */}
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

        {/* Controls Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              Voice
            </label>
            <Select value={selectedVoice} onValueChange={setSelectedVoice}>
              <SelectTrigger className="bg-muted/50 border-border">
                <SelectValue placeholder="Select a voice" />
              </SelectTrigger>
              <SelectContent>
                {voices.map((voice) => (
                  <SelectItem key={voice.name} value={voice.name}>
                    {voice.name} ({voice.lang})
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
        </div>

        {/* Generate Button */}
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

        {/* Audio Player */}
        {(hasGenerated || isGenerating) && (
          <div className="glass-card p-5 space-y-4 border-primary/20">
            <WaveformVisualizer isPlaying={isPlaying} />

            <div className="flex items-center justify-center">
              <button
                onClick={togglePlayback}
                className="w-14 h-14 rounded-full flex items-center justify-center bg-primary text-primary-foreground hover:bg-primary/90 transition-all glow-border"
              >
                {isPlaying ? (
                  <Pause className="w-6 h-6" />
                ) : (
                  <Play className="w-6 h-6 ml-0.5" />
                )}
              </button>
            </div>

            <p className="text-center text-sm text-muted-foreground">
              {isPlaying ? "Playing..." : "Ready to play"}
            </p>
          </div>
        )}
      </div>

      <p className="mt-8 text-sm text-muted-foreground">
        Powered by Web Speech API
      </p>
    </div>
  );
};

export default VoiceSync;
