'use client';

import { useEffect, useCallback } from 'react';
import { useCallsStore } from '@/lib/store/calls';
import { useAuthStore } from '@/lib/store/auth';
import { isDemoDataEnabled, shouldSkipGatewayFetch } from '@/lib/demo/config';
import { isSipReady } from '@/lib/env/telephony';
import { getWebRTCCredentials } from '@/lib/api/routing';
import type { CallSession } from '@/types';

const SIP_WSS = process.env.NEXT_PUBLIC_SIP_WSS ?? '';
const SIP_DOMAIN = process.env.NEXT_PUBLIC_SIP_DOMAIN ?? 'blinkone.local';
const SIP_USER = process.env.NEXT_PUBLIC_SIP_USER ?? 'agent';
const SIP_PASS = process.env.NEXT_PUBLIC_SIP_PASS ?? '';

interface JsSIPUA {
  start(): void;
  stop(): void;
  call(target: string, options: unknown): JsSIPRTCSession;
  on(event: string, handler: (...args: unknown[]) => void): void;
  removeAllListeners(): void;
  isRegistered(): boolean;
}

interface JsSIPRTCSession {
  answer(options?: unknown): void;
  terminate(): void;
  mute(opts?: { audio?: boolean }): void;
  unmute(opts?: { audio?: boolean }): void;
  hold(): Promise<void>;
  unhold(): Promise<void>;
  sendDTMF(tone: string, options?: { duration?: number; interToneGap?: number }): void;
  refer(target: string): void;
  on(event: string, handler: (...args: unknown[]) => void): void;
  isEnded?(): boolean;
}

function buildCallSession(
  partial: Pick<CallSession, 'id' | 'customerPhone' | 'status' | 'direction'> &
    Partial<CallSession>,
  user: { tenantId?: string; name?: string; email?: string } | null,
): CallSession {
  return {
    id: partial.id,
    tenantId: partial.tenantId ?? user?.tenantId ?? 'default',
    roomId: partial.roomId ?? partial.id,
    channel: 'voice',
    agentLabel: partial.agentLabel ?? user?.name ?? SIP_USER,
    customerPhone: partial.customerPhone,
    status: partial.status,
    transport: partial.transport ?? 'pstn',
    direction: partial.direction,
    startedAt: partial.startedAt ?? new Date().toISOString(),
    connectedAt: partial.connectedAt,
  };
}

let remoteAudio: HTMLAudioElement | null = null;

const uaRef = { current: null as JsSIPUA | null };
const sessionRef = { current: null as JsSIPRTCSession | null };
const incomingIdRef = { current: null as string | null };
const iceServersRef = { current: [{ urls: 'stun:stun.l.google.com:19302' }] as RTCIceServer[] };
let sipInitOwners = 0;

function getAudioElement(): HTMLAudioElement {
  if (!remoteAudio && typeof window !== 'undefined') {
    remoteAudio = new Audio();
    remoteAudio.autoplay = true;
    remoteAudio.id = '__bn_sip_audio__';
  }
  return remoteAudio!;
}

function attachRemoteStream(session: JsSIPRTCSession) {
  const conn = (session as unknown as { connection?: RTCPeerConnection }).connection;
  if (!conn) return;

  const audio = getAudioElement();
  const receivers = conn.getReceivers?.() ?? [];
  const audioTrack = receivers.find(r => r.track?.kind === 'audio')?.track;
  if (audioTrack) {
    audio.srcObject = new MediaStream([audioTrack]);
    void audio.play().catch(() => undefined);
    return;
  }

  const legacy = conn as RTCPeerConnection & { getRemoteStreams?: () => MediaStream[] };
  const streams = legacy.getRemoteStreams?.() ?? [];
  if (streams.length > 0) {
    audio.srcObject = streams[0];
    void audio.play().catch(() => undefined);
  }
}

function sessionEnded(session: JsSIPRTCSession | null): boolean {
  if (!session) return true;
  try {
    return session.isEnded?.() ?? false;
  } catch {
    return false;
  }
}

export function useJsSip() {
  const {
    setAgentState,
    addIncomingCall,
    removeIncomingCall,
    setActiveCall,
    setSipRegistered,
    setSipError,
    setMuted,
    setHeld,
    setMakeCall,
    setSipControls,
  } = useCallsStore();
  const { user, tokens } = useAuthStore();

  useEffect(() => {
    if (isDemoDataEnabled()) return;
    if (!isSipReady()) return;
    if (!tokens?.gatewayJwt) return;
    if (shouldSkipGatewayFetch()) return;

    sipInitOwners += 1;
    const isOwner = sipInitOwners === 1;
    if (!isOwner) {
      return () => {
        sipInitOwners -= 1;
      };
    }

    let ua: JsSIPUA | undefined;
    let destroyed = false;

    (async () => {
      try {
        if (user?.id && !shouldSkipGatewayFetch()) {
          const creds = await getWebRTCCredentials(String(user.id));
          iceServersRef.current = [
            ...creds.stunServers.map(s => ({ urls: s })),
            ...creds.turnServers.map(t => ({
              urls: t.urls,
              username: t.username,
              credential: t.credential,
            })),
          ];
        }
      } catch {
        iceServersRef.current = [{ urls: 'stun:stun.l.google.com:19302' }];
      }

      if (destroyed) return;

      try {
        const JsSIP = await import('jssip');
        if (destroyed) return;

        const sipUser = user?.email?.split('@')[0] ?? SIP_USER;
        const sipUri = `sip:${sipUser}@${SIP_DOMAIN}`;

        const UA = (JsSIP as unknown as { UA: new (cfg: unknown) => JsSIPUA }).UA;
        const WSIface = (JsSIP as unknown as { WebSocketInterface: new (u: string) => unknown })
          .WebSocketInterface;

        ua = new UA({
          sockets: [new WSIface(SIP_WSS)],
          uri: sipUri,
          password: SIP_PASS,
          display_name: user?.name ?? sipUser,
          register: true,
          register_expires: 120,
          session_timers: false,
          log: { level: 'warn' },
        });

        ua.on('registered', () => {
          if (destroyed) return;
          setSipRegistered(true);
          setSipError(null);
          setAgentState('available');
        });

        ua.on('unregistered', () => {
          if (destroyed) return;
          setSipRegistered(false);
          setAgentState('offline');
        });

        ua.on('registrationFailed', (data: unknown) => {
          if (destroyed) return;
          const cause = (data as { cause?: string })?.cause ?? 'Registration failed';
          setSipRegistered(false);
          setSipError(cause);
          setAgentState('offline');
        });

        ua.on('newRTCSession', (...args: unknown[]) => {
          const ev = args[0] as {
            session: JsSIPRTCSession;
            request?: { from?: { uri?: { user?: string; toString?: () => string } } };
            originator?: string;
          };
          const { session, originator } = ev;
          sessionRef.current = session;

          if (originator === 'remote') {
            const callerNum =
              ev.request?.from?.uri?.user ??
              ev.request?.from?.uri?.toString?.()?.split('@')[0] ??
              'unknown';
            const callId = crypto.randomUUID();
            incomingIdRef.current = callId;

            addIncomingCall(
              buildCallSession(
                {
                  id: callId,
                  customerPhone: callerNum,
                  status: 'ringing',
                  direction: 'inbound',
                },
                user,
              ),
            );

            session.on('ended', () => {
              if (incomingIdRef.current) removeIncomingCall(incomingIdRef.current);
            });
            session.on('failed', () => {
              if (incomingIdRef.current) removeIncomingCall(incomingIdRef.current);
            });
          } else {
            setActiveCall(
              buildCallSession(
                {
                  id: crypto.randomUUID(),
                  customerPhone: 'dialing…',
                  status: 'ringing',
                  direction: 'outbound',
                },
                user,
              ),
            );
          }

          session.on('confirmed', () => {
            if (destroyed) return;
            attachRemoteStream(session);
            setMuted(false);
            setHeld(false);
            setAgentState('busy');

            if (originator === 'remote' && incomingIdRef.current) {
              const id = incomingIdRef.current;
              removeIncomingCall(id);
              setActiveCall(
                buildCallSession(
                  {
                    id,
                    customerPhone: ev.request?.from?.uri?.user ?? 'unknown',
                    status: 'connected',
                    direction: 'inbound',
                    connectedAt: new Date().toISOString(),
                  },
                  user,
                ),
              );
              incomingIdRef.current = null;
            } else {
              const prev = useCallsStore.getState().activeCall;
              if (prev) {
                setActiveCall({
                  ...prev,
                  status: 'connected',
                  connectedAt: new Date().toISOString(),
                });
              }
            }
          });

          session.on('ended', () => {
            if (destroyed) return;
            sessionRef.current = null;
            const audio = getAudioElement();
            audio.srcObject = null;
            setActiveCall(null);
            setMuted(false);
            setHeld(false);
            setAgentState('available');
          });

          session.on('failed', () => {
            if (destroyed) return;
            sessionRef.current = null;
            setActiveCall(null);
            setMuted(false);
            setHeld(false);
            setAgentState('available');
          });
        });

        uaRef.current = ua;
        ua.start();
      } catch (err) {
        if (destroyed) return;
        if (process.env.NODE_ENV === 'development') {
          console.warn('[JsSIP] init skipped or failed', err);
        }
        setSipError(err instanceof Error ? err.message : 'SIP init failed');
      }
    })();

    return () => {
      destroyed = true;
      sipInitOwners -= 1;
      if (sipInitOwners > 0) return;
      try {
        uaRef.current?.stop();
      } catch {
        /* ignore */
      }
      uaRef.current = null;
    };
  }, [
    tokens?.gatewayJwt,
    user?.id,
    user?.email,
    user?.name,
    user?.tenantId,
    setAgentState,
    addIncomingCall,
    removeIncomingCall,
    setActiveCall,
    setSipRegistered,
    setSipError,
    setMuted,
    setHeld,
  ]);

  const pcConfig = useCallback(
    () => ({ iceServers: iceServersRef.current }),
    [],
  );

  const makeCall = useCallback(
    (destination: string) => {
      if (!uaRef.current?.isRegistered()) {
        console.warn('[JsSIP] not registered');
        return;
      }
      const target = destination.startsWith('sip:')
        ? destination
        : `sip:${destination}@${SIP_DOMAIN}`;

      sessionRef.current = uaRef.current.call(target, {
        mediaConstraints: { audio: true, video: false },
        rtcOfferConstraints: { offerToReceiveAudio: true, offerToReceiveVideo: false },
        pcConfig: pcConfig(),
      });
    },
    [pcConfig],
  );

  const answerCall = useCallback(() => {
    sessionRef.current?.answer({
      mediaConstraints: { audio: true, video: false },
      pcConfig: pcConfig(),
    });
  }, [pcConfig]);

  const hangup = useCallback(() => {
    const s = sessionRef.current;
    if (s && !sessionEnded(s)) {
      try {
        s.terminate();
      } catch {
        /* already ended */
      }
    }
    sessionRef.current = null;
    if (incomingIdRef.current) {
      removeIncomingCall(incomingIdRef.current);
      incomingIdRef.current = null;
    }
    setActiveCall(null);
    setMuted(false);
    setHeld(false);
    const audio = getAudioElement();
    audio.srcObject = null;
  }, [removeIncomingCall, setActiveCall, setMuted, setHeld]);

  const toggleMute = useCallback(() => {
    const s = sessionRef.current;
    if (!s) return;
    const isMuted = useCallsStore.getState().muted;
    if (isMuted) {
      s.unmute({ audio: true });
      setMuted(false);
    } else {
      s.mute({ audio: true });
      setMuted(true);
    }
  }, [setMuted]);

  const toggleHold = useCallback(() => {
    const s = sessionRef.current;
    if (!s) return;
    const isHeld = useCallsStore.getState().held;
    if (isHeld) {
      void s.unhold().then(() => setHeld(false)).catch(() => undefined);
    } else {
      void s.hold().then(() => setHeld(true)).catch(() => undefined);
    }
  }, [setHeld]);

  const sendDTMF = useCallback((tone: string) => {
    sessionRef.current?.sendDTMF(tone, { duration: 100, interToneGap: 70 });
  }, []);

  const blindTransfer = useCallback((target: string) => {
    const s = sessionRef.current;
    if (!s) return;
    const dest = target.startsWith('sip:') ? target : `sip:${target}@${SIP_DOMAIN}`;
    s.refer(dest);
  }, []);

  useEffect(() => {
    setMakeCall(makeCall);
    setSipControls({ hangup, toggleMute, toggleHold, answerCall, sendDTMF, blindTransfer });
    return () => {
      setMakeCall(null);
      setSipControls(null);
    };
  }, [
    makeCall,
    hangup,
    toggleMute,
    toggleHold,
    answerCall,
    sendDTMF,
    blindTransfer,
    setMakeCall,
    setSipControls,
  ]);

  return {
    makeCall,
    answerCall,
    hangup,
    toggleMute,
    toggleHold,
    sendDTMF,
    blindTransfer,
  };
}
