import { useEffect, useState } from "react";
import { Loader2, Play, Pause, Trash2, Download, History as HistoryIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

interface Generation {
  id: string;
  text: string;
  voice_name: string;
  audio_path: string;
  character_count: number;
  created_at: string;
}

interface RowState {
  audioUrl?: string;
  loading?: boolean;
  playing?: boolean;
}

const History = () => {
  const [items, setItems] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const [rowState, setRowState] = useState<Record<string, RowState>>({});
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchGenerations();
    return () => {
      audioEl?.pause();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchGenerations = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("generations")
      .select("id, text, voice_name, audio_path, character_count, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Failed to load history", description: error.message, variant: "destructive" });
    } else {
      setItems(data ?? []);
    }
    setLoading(false);
  };

  const getSignedUrl = async (path: string): Promise<string | null> => {
    const { data, error } = await supabase.storage
      .from("voice-audio")
      .createSignedUrl(path, 60 * 60);
    if (error || !data) return null;
    return data.signedUrl;
  };

  const togglePlay = async (gen: Generation) => {
    // Stop any current playback
    if (activeId && activeId !== gen.id) {
      audioEl?.pause();
      setRowState((s) => ({ ...s, [activeId]: { ...s[activeId], playing: false } }));
    }

    let url = rowState[gen.id]?.audioUrl;
    if (!url) {
      setRowState((s) => ({ ...s, [gen.id]: { ...s[gen.id], loading: true } }));
      url = (await getSignedUrl(gen.audio_path)) ?? undefined;
      setRowState((s) => ({ ...s, [gen.id]: { ...s[gen.id], loading: false, audioUrl: url } }));
      if (!url) {
        toast({ title: "Couldn't load audio", variant: "destructive" });
        return;
      }
    }

    if (audioEl && activeId === gen.id) {
      if (audioEl.paused) audioEl.play();
      else audioEl.pause();
      return;
    }

    const a = new Audio(url);
    a.onplay = () => setRowState((s) => ({ ...s, [gen.id]: { ...s[gen.id], playing: true } }));
    a.onpause = () => setRowState((s) => ({ ...s, [gen.id]: { ...s[gen.id], playing: false } }));
    a.onended = () => setRowState((s) => ({ ...s, [gen.id]: { ...s[gen.id], playing: false } }));
    setAudioEl(a);
    setActiveId(gen.id);
    a.play();
  };

  const downloadAudio = async (gen: Generation) => {
    const url = rowState[gen.id]?.audioUrl ?? (await getSignedUrl(gen.audio_path));
    if (!url) return;
    const res = await fetch(url);
    const blob = await res.blob();
    const dl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = dl;
    a.download = `${gen.voice_name}-${Date.now()}.mp3`;
    a.click();
    URL.revokeObjectURL(dl);
  };

  const deleteGeneration = async (gen: Generation) => {
    if (!confirm("Delete this generation?")) return;

    const { error: storageErr } = await supabase.storage.from("voice-audio").remove([gen.audio_path]);
    if (storageErr) console.warn("Storage delete:", storageErr);

    const { error } = await supabase.from("generations").delete().eq("id", gen.id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    setItems((curr) => curr.filter((g) => g.id !== gen.id));
    if (activeId === gen.id) audioEl?.pause();
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="flex items-center gap-3 mb-6">
        <HistoryIcon className="w-6 h-6 text-primary" />
        <h1 className="text-3xl font-bold">Your generations</h1>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : items.length === 0 ? (
        <div className="glass-card p-12 text-center space-y-3">
          <HistoryIcon className="w-12 h-12 text-muted-foreground mx-auto opacity-40" />
          <h2 className="text-lg font-semibold">No generations yet</h2>
          <p className="text-muted-foreground text-sm">
            Head back to Generate to create your first audio.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((gen) => {
            const state = rowState[gen.id] ?? {};
            return (
              <div key={gen.id} className="glass-card p-4 flex items-start gap-3">
                <button
                  onClick={() => togglePlay(gen)}
                  disabled={state.loading}
                  className="w-12 h-12 flex-shrink-0 rounded-full flex items-center justify-center bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  aria-label={state.playing ? "Pause" : "Play"}
                >
                  {state.loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : state.playing ? (
                    <Pause className="w-5 h-5" />
                  ) : (
                    <Play className="w-5 h-5 ml-0.5" />
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <p className="text-sm line-clamp-2 mb-1.5">{gen.text}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="text-primary font-medium">{gen.voice_name}</span>
                    <span>{gen.character_count} chars</span>
                    <span>{formatDistanceToNow(new Date(gen.created_at), { addSuffix: true })}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => downloadAudio(gen)} aria-label="Download">
                    <Download className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteGeneration(gen)}
                    aria-label="Delete"
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default History;
