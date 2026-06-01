'use client';

import { useEffect, useCallback } from 'react';
import { useCallsStore } from '@/lib/store/calls';
import { useAuthStore } from '@/lib/store/auth';
import { isDemoDataEnabled, shouldSkipGatewayFetch } from '@/lib/demo/config';
import { isPlaceholderEnv, isSipReady, resolveSipWsUri } from '@/lib/env/telephony';
import { getWebRTCCredentials, setAgentState as syncRoutingAgentState } from '@/lib/api/routing';
import { pstnSipTarget } from '@/lib/utils/phone';
import {
  bindSessionRemoteAudio,
  clearRemoteAudio,
} from '@/lib/telephony/sip-audio';
import {
  stopIncomingRingtone,
  startOutgoingRingback,
  stopOutgoingRingback,
} from '@/lib/telephony/ringtone';
import { presentIncomingCall, clearIncomingCallUi } from '@/lib/calling/incoming-call-ui';
import { answerCall as apiAnswerCall, declineCall as apiDeclineCall } from '@/lib/api/calls';
import { lookupContactAll } from '@/lib/api/connectors';
import { toast } from 'sonner';
import type { CallSession } from '@/types';

const SIP_WSS = process.env.NEXT_PUBLIC_SIP_WSS ?? '';
const SIP_DOMAIN = process.env.NEXT_PUBLIC_SIP_DOMAIN ?? 'blinkone.local';
const SIP_USER = process.env.NEXT_PUBLIC_SIP_USER ?? 'agent';
const SIP_PASS = process.env.NEXT_PUBLIC_SIP_PASS ?? '';

/** Registrar host for REGISTER (Kamailio/nginx); trunk domain stays SIP_DOMAIN for outbound. */
function sipRegistrarHost(): string {
  if (!SIP_WSS || isPlaceholderEnv(SIP_WSS)) return SIP_DOMAIN;
  try {
    return new URL(SIP_WSS).host;
  } catch {
    return SIP_DOMAIN;
  }
}

function sipAccountUser(user: { email?: string } | null): string {
  const envUser = SIP_USER?.trim();
  if (envUser) return envUser;
  return user?.email?.split('@')[0] ?? 'agent';
}

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

const uaRef = { current: null as JsSIPUA | null };
const sessionRef = { current: null as JsSIPRTCSession | null };
const incomingIdRef = { current: null as string | null };
const iceServersRef = { current: [{ urls: 'stun:stun.l.google.com:19302' }] as RTCIceServer[] };
const sipCredsRef = { current: { wsUri: SIP_WSS, sipUri: '', password: SIP_PASS } };
// Set when agent clicks Answer before Asterisk has dialled them (ARI-bridge race).
// The next incoming newRTCSession will be answered automatically.
const pendingAnswerRef = { current: false };
let sipInitOwners = 0;

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
    removeIncomingCall,
    setActiveCall,
    setSipRegistered,
    setSipError,
    setMuted,
    setHeld,
    setMakeCall,
    setSipControls,
  } = useCallsStore();
  const { user } = useAuthStore();

  useEffect(() => {
    if (isDemoDataEnabled()) return;
    if (!isSipReady()) return;

    sipInitOwners += 1;
    const isOwner = sipInitOwners === 1;
    if (!isOwner) {
      return () => { sipInitOwners -= 1; };
    }

    let ua: JsSIPUA | undefined;
    let destroyed = false;

    (async () => {
      let creds = {
        wsUri: SIP_WSS,
        sipUri: `sip:${sipAccountUser(user)}@${sipRegistrarHost()}`,
        password: SIP_PASS,
        stunServers: ['stun:stun.l.google.com:19302'],
        turnServers: [] as { urls: string; username: string; credential: string }[],
      };
      try {
        if (user?.id && !shouldSkipGatewayFetch()) {
          creds = { ...creds, ...(await getWebRTCCredentials(String(user.id))) };
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
      sipCredsRef.current = {
        wsUri: resolveSipWsUri(creds.wsUri, SIP_WSS),
        sipUri: creds.sipUri || `sip:${sipAccountUser(user)}@${sipRegistrarHost()}`,
        password: creds.password || SIP_PASS,
      };

      if (destroyed) return;

      try {
        const JsSIP = await import('jssip');
        if (destroyed) return;

        const UA = (JsSIP as unknown as { UA: new (cfg: unknown) => JsSIPUA }).UA;
        const WSIface = (JsSIP as unknown as { WebSocketInterface: new (u: string) => unknown })
          .WebSocketInterface;

        ua = new UA({
          sockets: [new WSIface(sipCredsRef.current.wsUri)],
          uri: sipCredsRef.current.sipUri,
          password: sipCredsRef.current.password,
          display_name: user?.name ?? sipAccountUser(user),
          register: true,
          register_expires: 120,
          session_timers: false,
          log: { level: 'warn' },
        });

        ua.on('registered', () => {
          if (destroyed) return;
          console.info('[JsSIP] UA registered');
          setSipRegistered(true);
          setSipError(null);
          setAgentState('available');
          if (user?.id && !shouldSkipGatewayFetch()) {
            void syncRoutingAgentState(String(user.id), 'available').catch((e: unknown) => {
              console.warn('[JsSIP] routing agent sync failed', e);
            });
          }
        });

        ua.on('unregistered', () => {
          if (destroyed) return;
          setSipRegistered(false);
          setAgentState('offline');
          if (user?.id && !shouldSkipGatewayFetch()) {
            void syncRoutingAgentState(String(user.id), 'offline').catch(() => {});
          }
        });

        ua.on('registrationFailed', (data: unknown) => {
          if (destroyed) return;
          const cause = (data as { cause?: string })?.cause ?? 'Registration failed';
          console.warn('[JsSIP] Registration failed:', cause);
          setSipRegistered(false);
          setSipError(cause);
          setAgentState('offline');
          if (user?.id && !shouldSkipGatewayFetch()) {
            void syncRoutingAgentState(String(user.id), 'offline').catch(() => {});
          }
          toast.error(`Softphone registration failed: ${cause}`);
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

            // If the agent already clicked Answer before the SIP INVITE arrived
            // (ARI-bridge or routing push beat the SIP signalling), auto-answer now.
            if (pendingAnswerRef.current) {
              pendingAnswerRef.current = false;
              stopIncomingRingtone();
              try {
                session.answer({
                  mediaConstraints: { audio: true, video: false },
                  rtcAnswerConstraints: { offerToReceiveAudio: true, offerToReceiveVideo: false },
                  pcConfig: { iceServers: iceServersRef.current },
                });
              } catch {
                /* session may have ended before answer */
              }
              return;
            }

            // Screen pop — async CRM lookup on caller ANI (D16)
            if (callerNum && callerNum !== 'unknown') {
              lookupContactAll(callerNum).then(contact => {
                if (contact) {
                  useCallsStore.getState().cacheContact(callerNum, contact.name ?? callerNum);
                  window.dispatchEvent(
                    new CustomEvent('blinkone:screen-pop', { detail: { phone: callerNum, contact } }),
                  );
                }
              }).catch(() => undefined);
            }

            const incomingSession = buildCallSession(
              {
                id: callId,
                customerPhone: callerNum,
                status: 'ringing',
                direction: 'inbound',
              },
              user,
            );

            presentIncomingCall(incomingSession, {
              onAnswer: () => {
                clearIncomingCallUi(callId);
                // SIP answer — sends 200 OK regardless of backend sync result
                try {
                  session.answer({ mediaConstraints: { audio: true, video: false } });
                } catch {
                  /* session may have ended */
                }
                const connectedSession = {
                  ...incomingSession,
                  status: 'connected' as const,
                  connectedAt: new Date().toISOString(),
                };
                // Try to sync with backend calls service; fall back gracefully
                // because WebRTC-only calls have no pre-existing call record.
                void apiAnswerCall(callId)
                  .then(s => setActiveCall(s))
                  .catch(() => setActiveCall(connectedSession));
              },
              onDecline: () => {
                clearIncomingCallUi(callId);
                try {
                  session.terminate();
                } catch {
                  /* ignore */
                }
                void apiDeclineCall(callId).catch(() => undefined);
              },
            });

            session.on('peerconnection', () => {
              bindSessionRemoteAudio(session as unknown as { connection?: RTCPeerConnection });
            });

            session.on('progress', () => {
              bindSessionRemoteAudio(session as unknown as { connection?: RTCPeerConnection });
            });

            session.on('ended', () => {
              if (incomingIdRef.current) clearIncomingCallUi(incomingIdRef.current);
            });
            session.on('failed', () => {
              if (incomingIdRef.current) clearIncomingCallUi(incomingIdRef.current);
            });
          } else {
            // Outbound call — show ringing state immediately
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

          session.on('peerconnection', () => {
            bindSessionRemoteAudio(session as unknown as { connection?: RTCPeerConnection });
          });

          session.on('progress', () => {
            bindSessionRemoteAudio(session as unknown as { connection?: RTCPeerConnection });
            // Outbound leg is ringing — play a local ringback (carrier ringback
            // isn't audible over WebRTC until media/DTLS is up after answer).
            if (originator !== 'remote') void startOutgoingRingback();
          });

          session.on('confirmed', () => {
            if (destroyed) return;
            stopIncomingRingtone();
            stopOutgoingRingback();
            bindSessionRemoteAudio(session as unknown as { connection?: RTCPeerConnection });
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
            stopIncomingRingtone();
            stopOutgoingRingback();
            sessionRef.current = null;
            clearRemoteAudio();
            setActiveCall(null);
            setMuted(false);
            setHeld(false);
            setAgentState('available');
          });

          session.on('failed', (ev: unknown) => {
            if (destroyed) return;
            stopIncomingRingtone();
            stopOutgoingRingback();
            const failEv = ev as {
              cause?: string;
              message?: { status_code?: number; reason_phrase?: string };
              originator?: string;
            };
            const cause = failEv.cause ?? 'unknown';
            const sipCode = failEv.message?.status_code;
            const sipReason = failEv.message?.reason_phrase;
            const detail =
              sipCode != null
                ? `${cause} (SIP ${sipCode}${sipReason ? ` ${sipReason}` : ''})`
                : cause;

            // Ignore spurious ICE/SDP failures during WSS reconnect
            if (failEv.originator === 'system' && cause === 'WebRTC Error') {
              console.warn('[JsSIP] WebRTC error during signaling — likely reconnect');
              return;
            }

            const userHint =
              sipCode === 403 || cause === 'Rejected'
                ? ' — check Twilio trial verified numbers, geo permissions, and trunk credentials'
                : '';
            toast.error(`Call failed: ${detail}${userHint}`);

            sessionRef.current = null;
            setActiveCall(null);
            setSipError(String(cause));
            setMuted(false);
            setHeld(false);
            setAgentState('available');
          });
        });

        ua.on('connected', () => {
          if (destroyed) return;
          console.info('[JsSIP] WSS transport connected');
        });

        ua.on('disconnected', () => {
          if (destroyed) return;
          setSipRegistered(false);
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
    user?.id,
    user?.email,
    user?.name,
    user?.tenantId,
    setAgentState,
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
      const registered = !!uaRef.current?.isRegistered();
      if (!registered || !uaRef.current) {
        console.warn('[JsSIP] makeCall blocked — not registered');
        toast.error('Softphone not connected — wait for "Softphone connected" in the sidebar.');
        return;
      }
      const target = pstnSipTarget(destination, SIP_DOMAIN);
      try {
        sessionRef.current = uaRef.current.call(target, {
          mediaConstraints: { audio: true, video: false },
          rtcOfferConstraints: { offerToReceiveAudio: true, offerToReceiveVideo: false },
          pcConfig: pcConfig(),
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Call failed';
        toast.error(msg);
        setSipError(msg);
      }
    },
    [pcConfig, setSipError],
  );

  /** Direct WebRTC call to another registered agent (numeric agent id). */
  const makePeerCall = useCallback(
    (targetAgentId: string) => {
      const registered = !!uaRef.current?.isRegistered();
      if (!registered || !uaRef.current) {
        toast.error('Softphone not connected');
        return;
      }
      const agentId = targetAgentId.replace(/\D/g, '');
      const domain = sipCredsRef.current.sipUri.split('@')[1] || SIP_DOMAIN;
      const target = `sip:${agentId}@${domain}`;
      try {
        sessionRef.current = uaRef.current.call(target, {
          mediaConstraints: { audio: true, video: false },
          rtcOfferConstraints: { offerToReceiveAudio: true, offerToReceiveVideo: false },
          pcConfig: pcConfig(),
        });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Peer call failed');
      }
    },
    [pcConfig],
  );

  const answerCall = useCallback(() => {
    const session = sessionRef.current;
    if (!session) {
      // No SIP session yet — agent clicked Answer before Asterisk/Kamailio dialled them.
      // Set a pending flag: the next incoming newRTCSession will be auto-answered.
      pendingAnswerRef.current = true;
      console.info('[JsSIP] answerCall: no session yet, pending auto-answer on next INVITE');
      return;
    }
    pendingAnswerRef.current = false;
    stopIncomingRingtone();
    try {
      session.answer({
        mediaConstraints: { audio: true, video: false },
        rtcAnswerConstraints: { offerToReceiveAudio: true, offerToReceiveVideo: false },
        pcConfig: pcConfig(),
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Answer failed');
    }
  }, [pcConfig]);

  const hangup = useCallback(() => {
    stopIncomingRingtone();
    stopOutgoingRingback();
    pendingAnswerRef.current = false;
    const s = sessionRef.current;
    if (s && !sessionEnded(s)) {
      try { s.terminate(); } catch { /* already ended */ }
    }
    sessionRef.current = null;
    if (incomingIdRef.current) {
      removeIncomingCall(incomingIdRef.current);
      incomingIdRef.current = null;
    }
    setActiveCall(null);
    setMuted(false);
    setHeld(false);
    clearRemoteAudio();
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

  return { makeCall, makePeerCall, answerCall, hangup, toggleMute, toggleHold, sendDTMF, blindTransfer };
}
