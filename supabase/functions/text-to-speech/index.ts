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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth
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

    // Validate body
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

    const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "TTS service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call ElevenLabs
    const elevenRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
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

    if (!elevenRes.ok) {
      const errText = await elevenRes.text();
      console.error("ElevenLabs error:", elevenRes.status, errText);
      return new Response(
        JSON.stringify({ error: `Voice generation failed (${elevenRes.status})` }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const audioBuffer = await elevenRes.arrayBuffer();

    // Upload to storage with service role
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

    // Insert generation record
    const { data: genRow, error: insertError } = await adminClient
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

    if (insertError) {
      console.error("Insert error:", insertError);
    }

    // Signed URL valid for 24h
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
