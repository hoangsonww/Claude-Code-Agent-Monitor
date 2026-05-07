/**
 * @file MicButton.tsx
 * @description Voice-input affordance for the composer. Uses the Web Speech
 * API (`webkitSpeechRecognition` / `SpeechRecognition`) to transcribe spoken
 * input and append it to the composer textarea. Falls back to a disabled
 * button with a "not supported" tooltip on browsers without the API. The
 * adjacent chevron is a v1 stub for a future language picker.
 */
import { useEffect, useRef, useState } from "react";
import { Box, IconButton, Tooltip, keyframes } from "@mui/material";
import { Mic, ChevronDown } from "lucide-react";

// Minimal type surface for the Web Speech API. The browser-provided types
// vary by vendor (and aren't part of TypeScript's lib.dom by default in some
// configurations), so we declare the slice we depend on.
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
  resultIndex: number;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    webkitSpeechRecognition?: SpeechRecognitionCtor;
    SpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

const pulse = keyframes`
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.55; transform: scale(1.15); }
`;

interface Props {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

export function MicButton({ onTranscript, disabled }: Props) {
  const Ctor = getRecognitionCtor();
  const supported = Ctor !== null;
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  // Stop listening if the component unmounts mid-dictation.
  useEffect(() => {
    return () => {
      try {
        recRef.current?.abort();
      } catch {
        /* noop */
      }
    };
  }, []);

  const start = () => {
    if (!Ctor || disabled) return;
    try {
      const rec = new Ctor();
      rec.lang = "en-US";
      rec.continuous = false;
      rec.interimResults = false;
      rec.onresult = (e) => {
        let collected = "";
        for (let i = e.resultIndex; i < e.results.length; i += 1) {
          const r = e.results[i];
          if (r && r.isFinal && r[0]?.transcript) {
            collected += r[0].transcript;
          }
        }
        if (collected) onTranscript(collected.trim());
      };
      rec.onerror = () => setListening(false);
      rec.onend = () => setListening(false);
      recRef.current = rec;
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  };

  const stop = () => {
    try {
      recRef.current?.stop();
    } catch {
      /* noop */
    }
    setListening(false);
  };

  const tooltip = !supported
    ? "Voice input not supported in this browser."
    : listening
      ? "Stop dictation"
      : "Voice input (en-US)";

  return (
    <Box sx={{ display: "inline-flex", alignItems: "center" }}>
      <Tooltip title={tooltip} placement="top">
        <span>
          <IconButton
            size="small"
            aria-label={listening ? "Stop voice input" : "Start voice input"}
            disabled={disabled || !supported}
            onClick={listening ? stop : start}
            sx={{
              color: listening ? "warning.main" : undefined,
              animation: listening ? `${pulse} 1.1s ease-in-out infinite` : "none",
            }}
          >
            <Mic size={16} />
          </IconButton>
        </span>
      </Tooltip>
      {/* TODO: wire this chevron to a real language picker. v1 hardcodes
          en-US; for now the click is a no-op with an explanatory tooltip. */}
      <Tooltip title="Language picker coming soon" placement="top">
        <span>
          <IconButton
            size="small"
            aria-label="Voice language (coming soon)"
            disabled
            sx={{ p: 0.25 }}
          >
            <ChevronDown size={12} />
          </IconButton>
        </span>
      </Tooltip>
    </Box>
  );
}
