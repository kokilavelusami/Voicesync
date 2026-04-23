import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const VOICES: Record<string, string> = {
  "9BWtsMINqrJLrRacOk9x": "Aria",
  "CwhRBWXzGAHq8TQ4Fs17": "Roger",
  "EXAVITQu4vr4xnSDxMaL": "Sarah",
  "FGY2WhTYpPnrIDTdsKH5": "Laura",
  "IKne3meq5aSn9XLyUdCD": "Charlie",
  "JBFqnCBsd6RMkjVDRZzb": "George",
  "TX3LPaxmHKxFdv7VOQHJ": "Liam",
  "XB0fDUnXU5powFXDhCwa": "Charlotte",
  "Xb7hH8MSUJpSbSDYk0k2": "Alice",
  "pFZP5JQG7iQjIQuC4Bku": "Lily",
  "pqHfZKP75CvOlQylNhV4": "Bill",
};

// Map ElevenLabs voice IDs to OpenAI TTS voices for fallback
const FALLBACK_VOICE_MAP: Record<string, string> = {
  "9BWtsMINqrJLrRacOk9x": "nova",
  "EXAVITQu4vr4xnSDxMaL": "shimmer",
  "FGY2WhTYpPnrIDTdsKH5": "nova",
  "Xb7hH8MSUJpSbSDYk0k2": "shimmer",
  "pFZP5JQG7iQjIQuC4Bku": "shimmer",
  "CwhRBWXzGAHq8TQ4Fs17": "onyx",
  "JBFqnCBsd6RMkjVDRZzb": "echo",
  "IKne3meq5aSn9XLyUdCD": "fable",
  "TX3LPaxmHKxFdv7VOQHJ": "onyx",
  "pqHfZKP75CvOlQylNhV4": "onyx",
  "XB0fDUnXU5powFXDhCwa": "nova",
};

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function tryElevenLabs(text: string, voiceId: string): Promise<ArrayBuffer | null> {
  const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
  if (!apiKey) return null;

  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          model_id: "eleven_turbo_v2_5",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.3,
            use_speaker_boost: true,
          },
        }),
      },
    );
    if (!res.ok) {
      console.warn(`ElevenLabs failed (${res.status}), falling back`);
      return null;
    }
    return await res.arrayBuffer();
  } catch (e) {
    console.warn("ElevenLabs error, falling back:", e);
    return null;
  }
}

async function tryLovableAI(text: string, voiceId: string): Promise<ArrayBuffer | null> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return null;

  const voice = FALLBACK_VOICE_MAP[voiceId] ?? "alloy";
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini-tts",
        input: text,
        voice,
        response_format: "mp3",
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error(`Lovable AI TTS failed (${res.status}):`, errText);
      return null;
    }
    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      const json = await res.json();
      if (json.audio) return base64ToArrayBuffer(json.audio);
      if (json.data?.[0]?.b64_json) return base64ToArrayBuffer(json.data[0].b64_json);
      console.error("Lovable AI: unexpected JSON shape", json);
      return null;
    }
    return await res.arrayBuffer();
  } catch (e) {
    console.error("Lovable AI error:", e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const body = await req.json().catch(() => null);
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    const voiceId = typeof body?.voiceId === "string" ? body.voiceId : "";

    if (!text || text.length < 1 || text.length > 5000) {
      return new Response(JSON.stringify({ error: "Text must be 1–5000 characters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!VOICES[voiceId]) {
      return new Response(JSON.stringify({ error: "Invalid voice" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Try ElevenLabs first, then fall back to Lovable AI
    let provider: "elevenlabs" | "lovable_ai" = "elevenlabs";
    let audioBuffer = await tryElevenLabs(text, voiceId);
    if (!audioBuffer) {
      provider = "lovable_ai";
      audioBuffer = await tryLovableAI(text, voiceId);
    }

    if (!audioBuffer) {
      return new Response(
        JSON.stringify({ error: "All voice providers are unavailable. Please try again later." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const adminClient = createClient(supabaseUrl, serviceKey);
    const fileName = `${userId}/${crypto.randomUUID()}.mp3`;

    const { error: uploadError } = await adminClient.storage
      .from("voice-audio")
      .upload(fileName, audioBuffer, { contentType: "audio/mpeg", upsert: false });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return new Response(JSON.stringify({ error: "Failed to save audio" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: genRow } = await adminClient
      .from("generations")
      .insert({
        user_id: userId,
        text,
        voice_id: voiceId,
        voice_name: VOICES[voiceId],
        audio_path: fileName,
        character_count: text.length,
      })
      .select()
      .single();

    const { data: signed, error: signError } = await adminClient.storage
      .from("voice-audio")
      .createSignedUrl(fileName, 60 * 60 * 24);

    if (signError || !signed) {
      return new Response(JSON.stringify({ error: "Failed to create audio URL" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        audioUrl: signed.signedUrl,
        audioPath: fileName,
        generationId: genRow?.id ?? null,
        voiceName: VOICES[voiceId],
        provider,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Unhandled error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
