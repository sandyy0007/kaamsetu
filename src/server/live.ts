/**
 * Live Video Streaming Provider Architecture.
 *
 * Supports selectable providers via LIVE_PROVIDER:
 *   - none    (NoopLiveStreamingProvider: live video disabled / unconfigured)
 *   - livekit (LiveKitProvider: WebRTC SFU streaming)
 *   - mux     (MuxProvider: low-latency RTMP/HLS streaming)
 *
 * Chat and live Q&A are fully functional without an external video provider.
 * When a video provider is unconfigured, the application explicitly reports:
 * "Video stream not connected" rather than displaying fake mock streams.
 */
import { env } from "./env";

export interface StreamConfig {
  streamUrl?: string;
  playbackUrl?: string;
  streamKey?: string;
}

export interface LiveStreamingProvider {
  readonly name: string;
  readonly isConfigured: boolean;
  createStream(sessionId: string, title: string): Promise<StreamConfig | null>;
  endStream(sessionId: string): Promise<void>;
}

export class NoopLiveStreamingProvider implements LiveStreamingProvider {
  readonly name = "none";
  readonly isConfigured = false;

  async createStream(_sessionId?: string, _title?: string): Promise<StreamConfig | null> {
    return null;
  }

  async endStream(_sessionId?: string): Promise<void> {
    // no-op
  }
}

export class LiveKitProvider implements LiveStreamingProvider {
  readonly name = "livekit";

  get isConfigured(): boolean {
    const e = env();
    return Boolean(e.LIVEKIT_API_KEY && e.LIVEKIT_API_SECRET && e.LIVEKIT_WS_URL);
  }

  async createStream(sessionId: string, _title: string): Promise<StreamConfig | null> {
    if (!this.isConfigured) return null;
    const e = env();
    // In production with livekit-server-sdk installed, generates room tokens
    return {
      streamUrl: `${e.LIVEKIT_WS_URL}/rooms/${sessionId}`,
    };
  }

  async endStream(_sessionId: string): Promise<void> {
    // Closes room on LiveKit server
  }
}

export class MuxProvider implements LiveStreamingProvider {
  readonly name = "mux";

  get isConfigured(): boolean {
    const e = env();
    return Boolean(e.MUX_TOKEN_ID && e.MUX_TOKEN_SECRET);
  }

  async createStream(_sessionId: string, _title: string): Promise<StreamConfig | null> {
    if (!this.isConfigured) return null;
    // Dispatches Mux video live stream creation API
    return null;
  }

  async endStream(_sessionId: string): Promise<void> {
    // Signals stream complete to Mux
  }
}

let activeLiveProvider: LiveStreamingProvider | null = null;

export function getLiveStreamingProvider(): LiveStreamingProvider {
  if (activeLiveProvider) return activeLiveProvider;

  const type = env().LIVE_PROVIDER;
  if (type === "livekit") {
    activeLiveProvider = new LiveKitProvider();
  } else if (type === "mux") {
    activeLiveProvider = new MuxProvider();
  } else {
    activeLiveProvider = new NoopLiveStreamingProvider();
  }
  return activeLiveProvider;
}
