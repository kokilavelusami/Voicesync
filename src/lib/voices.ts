export interface Voice {
  id: string;
  name: string;
  description: string;
  accent: string;
}

export const VOICES: Voice[] = [
  { id: "9BWtsMINqrJLrRacOk9x", name: "Aria", description: "Expressive female", accent: "American" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", description: "Soft & professional", accent: "American" },
  { id: "FGY2WhTYpPnrIDTdsKH5", name: "Laura", description: "Upbeat & friendly", accent: "American" },
  { id: "Xb7hH8MSUJpSbSDYk0k2", name: "Alice", description: "Confident female", accent: "British" },
  { id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily", description: "Warm & gentle", accent: "British" },
  { id: "CwhRBWXzGAHq8TQ4Fs17", name: "Roger", description: "Classic male", accent: "American" },
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George", description: "Warm narrator", accent: "British" },
  { id: "IKne3meq5aSn9XLyUdCD", name: "Charlie", description: "Natural conversational", accent: "Australian" },
  { id: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam", description: "Articulate male", accent: "American" },
  { id: "pqHfZKP75CvOlQylNhV4", name: "Bill", description: "Deep & trustworthy", accent: "American" },
  { id: "XB0fDUnXU5powFXDhCwa", name: "Charlotte", description: "Sultry & engaging", accent: "Swedish" },
];

export const DEFAULT_VOICE_ID = VOICES[0].id;
