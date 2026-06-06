import { useEffect, useRef, useCallback } from 'react';
import { useCallsStore } from '@/store/calls';
import { useAuthStore } from '@/store/auth';
import { loadPrefs } from '@/lib/storage';
import { randomId } from '@/lib/uuid';
import { installWebRtcGlobals } from '@/lib/webrtc';
import {
  createCall,
  answerCall as apiAnswerCall,
  declineCall as apiDeclineCall,
  hangupCall as apiHangupCall,
} from '@/api/calls';
import { getWebRTCCredentials, completeRoute, setAgentState as syncRoutingAgentState } from '@/api/routing';
import { SIP_WSS, SIP_DOMAIN, SIP_PASS, STUN, TURN_SERVER, TURN_USER, TURN_PASS, resolveSipWsUri } from '@/lib/env';
import { sipDialUri } from '@/lib/utils/sip-target';
import { cancelCustomerCall } from '@/api/customer';
import { prepareOutboundCallAudio } from '@/lib/sip-media';
import { startCallAudio, stopCallAudio } from '@/lib/audio';
import type { CallSession } from '@/types';

interface SipUA {
  start(): void;
  stop(): void;
  call(target: string, options: unknown): SipSession;
  on(event: string, handler: (...args: unknown[]) => void): void;
  isRegistered(): boolean;
}

interface SipSession {
  answer(options?: unknown): void;
  terminate(): void;
  mute(options?: { audio: boolean }): void;
  unmute(options?: { audio: boolean }): void;
  hold(): Promise<void>;
  unhold(): Promise<void>;
  sendDTMF?(tone: string, options?: unknown): void;
  on(event: string, handler: (...args: unknown[]) => void): void;
}

export function useJsSip() {
  const uaRef = useRef<SipUA | null>(null);
  const sessionRef = useRef<SipSession | null>(null);
  const backendSessionIdRef = useRef<string | null>(null);
  const routingCallIdRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const iceServersRef = useRef<RTCIceServer[]>([{ urls: STUN }]);
  const isAgentRef = useRef(false);
  const localStreamRef = useRef<MediaStream | null>(null);
  const teardownGuardRef = useRef(false);
  const outboundDialLockRef = useRef(false);
  const teardownRef = useRef<(opts: { sendBye: boolean; outcome?: 'hangup' | 'decline' }) => void>(
    () => {},
  );

  const {
    setActiveCall,
    addIncomingCall,
    removeIncomingCall,
    setAgentState,
    setSipRegistered,
    setMuted,
    setOnHold,
    setCallDuration,
  } = useCallsStore();
  const { user, tokens } = useAuthStore();

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const syncBackendSession = useCallback(
    async (payload: Parameters<typeof createCall>[0]) => {
      if (!tokens?.gatewayJwt || !user) return null;
      try {
        const session = await createCall({
          chatwootAccountId: user.chatwootAccountId,
          agentLabel: user.name,
          assignedAgentId: String(user.id),
          ...payload,
        });
        backendSessionIdRef.current = session.id;
        if (payload.customerPhone) routingCallIdRef.current = session.id;
        return session;
      } catch (err) {
        console.warn('[JsSIP] backend session sync failed', err);
        return null;
      }
    },
    [tokens?.gatewayJwt, user],
  );

  const finishBackendCall = useCallback(
    async (outcome: 'hangup' | 'decline' = 'hangup') => {
      const store = useCallsStore.getState();
      const active = store.activeCall;
      const acdId = store.customerQueueCallId;
      const roomId = active?.roomId?.trim();

      if (!isAgentRef.current && acdId) {
        try {
          await cancelCustomerCall(acdId);
        } catch {
          /* best-effort */
        }
        store.setCustomerQueueCallId(null);
      }

      const routeId =
        routingCallIdRef.current ??
        (roomId && roomId !== active?.id ? roomId : roomId) ??
        acdId ??
        null;
      routingCallIdRef.current = null;

      if (isAgentRef.current && routeId && user?.id) {
        try {
          await completeRoute({
            callId: routeId,
            agentId: String(user.id),
            disposition: outcome === 'decline' ? 'declined' : 'completed',
          });
        } catch {
          /* ACD sync best-effort */
        }
      }

      const id = backendSessionIdRef.current ?? active?.id;
      backendSessionIdRef.current = null;
      if (!id) return;
      try {
        if (outcome === 'decline') await apiDeclineCall(id, roomId);
        else await apiHangupCall(id, roomId);
      } catch {
        /* CDR sync best-effort */
      }
    },
    [user?.id],
  );

  const teardownCallSession = useCallback(
    async ({ sendBye, outcome = 'hangup' }: { sendBye: boolean; outcome?: 'hangup' | 'decline' }) => {
      if (!sendBye && teardownGuardRef.current) return;
      teardownGuardRef.current = true;
      outboundDialLockRef.current = false;

      const session = sessionRef.current;
      if (sendBye && session) {
        try {
          session.terminate();
        } catch {
          /* already ended */
        }
      }

      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      sessionRef.current = null;
      stopCallAudio();
      clearTimer();
      setActiveCall(null);
      setMuted(false);
      setOnHold(false);
      setCallDuration(0);
      if (isAgentRef.current) setAgentState('available');

      await finishBackendCall(outcome);
    },
    [clearTimer, finishBackendCall, setActiveCall, setAgentState, setCallDuration, setMuted, setOnHold],
  );

  teardownRef.current = (opts) => {
    void teardownCallSession(opts);
  };

  useEffect(() => {
    if (!installWebRtcGlobals()) return;

    let cancelled = false;

    (async () => {
      const prefs = await loadPrefs();
      const isAgent = prefs.role === 'agent';
      isAgentRef.current = isAgent;
      if (isAgent && !tokens?.gatewayJwt) return;

      let wssUrl = SIP_WSS;
      let sipUri = isAgent ? `sip:blinkone@${SIP_DOMAIN}` : `sip:customer@${SIP_DOMAIN}`;
      let sipPassword = SIP_PASS;

      if (isAgent && user?.id) {
        try {
          const creds = await getWebRTCCredentials(String(user.id));
          wssUrl = resolveSipWsUri(creds.wsUri);
          sipPassword = creds.password || SIP_PASS;
          // Per-agent AOR — do not register as shared "blinkone" or mobile steals the
          // browser softphone registration used for PSTN inbound + web agent calls.
          sipUri = `sip:${user.id}@${SIP_DOMAIN}`;
          iceServersRef.current = [
            ...creds.stunServers.map((s) => ({ urls: s })),
            ...creds.turnServers.map((t) => ({
              urls: t.urls,
              username: t.username,
              credential: t.credential,
            })),
          ];
        } catch (err) {
          console.warn('[JsSIP] webrtc creds fetch failed, using env fallback', err);
          if (!SIP_WSS || !SIP_PASS) return;
          iceServersRef.current = [{ urls: STUN }];
        }
      } else if (!SIP_WSS || !SIP_PASS) {
        return;
      }

      if (!isAgent) {
        iceServersRef.current = [{ urls: STUN }];
        if (TURN_SERVER) {
          iceServersRef.current.push({
            urls: TURN_SERVER,
            username: TURN_USER || undefined,
            credential: TURN_PASS || undefined,
          });
        }
      }

      if (!wssUrl || !sipPassword) return;

      try {
        const JsSIP = require('jssip');
        try {
          (JsSIP as { debug?: { enable: (s: string) => void } }).debug?.enable('JsSIP:*');
        } catch {
          /* optional */
        }

        const ua: SipUA = new (JsSIP as unknown as { UA: new (c: unknown) => SipUA }).UA({
          sockets: [
            new (JsSIP as unknown as { WebSocketInterface: new (url: string) => unknown }).WebSocketInterface(
              wssUrl,
            ),
          ],
          uri: sipUri,
          password: sipPassword,
          display_name: user?.name ?? sipUri.split(':')[1]?.split('@')[0] ?? 'agent',
          register: true,
          register_expires: 120,
          session_timers: false,
        });

        ua.on('registered', () => {
          setSipRegistered(true);
          if (isAgent) {
            setAgentState('available');
            if (user?.id) {
              void syncRoutingAgentState(String(user.id), 'available').catch(() => {});
            }
          }
        });
        ua.on('unregistered', () => {
          setSipRegistered(false);
          if (isAgent) {
            setAgentState('offline');
            if (user?.id) {
              void syncRoutingAgentState(String(user.id), 'offline').catch(() => {});
            }
          }
        });
        ua.on('registrationFailed', () => {
          setSipRegistered(false);
          if (isAgent) {
            setAgentState('offline');
            if (user?.id) {
              void syncRoutingAgentState(String(user.id), 'offline').catch(() => {});
            }
          }
        });

        ua.on('newRTCSession', (data: unknown) => {
          const evt = data as {
            session: SipSession;
            originator: string;
            request?: { from?: { display_name?: string; uri?: { user?: string } } };
          };
          const { session, originator } = evt;
          teardownGuardRef.current = false;
          sessionRef.current = session;

          const callerNum = evt.request?.from?.uri?.user ?? 'unknown';
          const callerName = evt.request?.from?.display_name ?? callerNum;
          const isInbound = originator === 'remote';

          if (isInbound) {
            const incoming = {
              callId: randomId(),
              callerName,
              callerNumber: callerNum,
              startedAt: new Date().toISOString(),
            };
            addIncomingCall(incoming);

            void syncBackendSession({
              customerPhone: callerNum,
              direction: 'inbound',
              transport: callerNum.length <= 8 && /^[0-9]+$/.test(callerNum) ? 'webrtc' : 'pstn',
            });

            session.on('ended', () => {
              removeIncomingCall(incoming.callId);
              teardownRef.current({ sendBye: false, outcome: 'hangup' });
            });

            session.on('failed', () => {
              removeIncomingCall(incoming.callId);
              teardownRef.current({ sendBye: false, outcome: 'decline' });
            });
          }

          session.on('confirmed', async () => {
            if (isAgent) setAgentState('busy');
            clearTimer();
            let sec = 0;
            timerRef.current = setInterval(() => {
              sec++;
              setCallDuration(sec);
            }, 1000);

            let backendId = backendSessionIdRef.current;
            if (!backendId) {
              const created = await syncBackendSession({
                customerPhone: isInbound ? callerNum : undefined,
                direction: isInbound ? 'inbound' : 'outbound',
                transport: 'pstn',
              });
              backendId = created?.id ?? null;
            }

            if (backendId) {
              try {
                const roomId = useCallsStore.getState().activeCall?.roomId;
                const s = await apiAnswerCall(backendId, roomId);
                setActiveCall(s);
                return;
              } catch {
                /* fall through to local session */
              }
            }

            setActiveCall({
              id: backendId ?? randomId(),
              tenantId: user?.tenantId ?? 'default',
              roomId: backendId ?? randomId(),
              channel: 'voice',
              agentLabel: user?.name ?? 'agent',
              customerPhone: isInbound ? callerNum : 'dialing',
              status: 'connected',
              transport: 'pstn',
              direction: isInbound ? 'inbound' : 'outbound',
              startedAt: new Date().toISOString(),
            });
          });

          session.on('ended', () => {
            teardownRef.current({ sendBye: false, outcome: 'hangup' });
          });

          session.on('failed', () => {
            teardownRef.current({ sendBye: false, outcome: 'decline' });
          });
        });

        if (cancelled) return;
        uaRef.current = ua;
        ua.start();
      } catch (err) {
        console.error('[JsSIP] init error', err);
      }
    })();

    return () => {
      cancelled = true;
      uaRef.current?.stop();
      uaRef.current = null;
      setSipRegistered(false);
      clearTimer();
    };
  }, [
    tokens?.gatewayJwt,
    user?.email,
    user?.name,
    user?.tenantId,
    user?.id,
    user?.chatwootAccountId,
    syncBackendSession,
    finishBackendCall,
    clearTimer,
  ]);

  const makeCall = useCallback(
    async (destination: string, transport: 'pstn' | 'webrtc' = 'pstn'): Promise<boolean> => {
      const ua = uaRef.current;
      if (!ua?.isRegistered()) {
        console.warn('[JsSIP] UA not registered, aborting call');
        return false;
      }

      const existing = sessionRef.current;
      const active = useCallsStore.getState().activeCall;
      if (existing || active || outboundDialLockRef.current) {
        console.warn('[JsSIP] outbound skipped — call already active');
        return !!existing || !!active;
      }
      outboundDialLockRef.current = true;

      const raw = destination.trim();
      const lower = raw.toLowerCase();
      let dialUser = raw.replace(/^sip:/, '').split('@')[0];
      let callTransport: 'pstn' | 'webrtc' = transport;

      if (lower === 'blinkone' || lower === 'desk' || lower === 'web') {
        dialUser = 'blinkone';
        callTransport = 'webrtc';
      } else if (/^[0-9]{1,8}$/.test(dialUser)) {
        callTransport = 'webrtc';
      } else if (/^\+?[0-9]{10,15}$/.test(dialUser.replace(/\D/g, ''))) {
        callTransport = 'pstn';
      }

      let localStream: Awaited<ReturnType<typeof prepareOutboundCallAudio>>;
      try {
        localStream = await prepareOutboundCallAudio();
        localStreamRef.current = localStream;
      } catch (e) {
        console.warn('[JsSIP] microphone / WebRTC setup failed', e);
        outboundDialLockRef.current = false;
        return false;
      }

      const queueId = useCallsStore.getState().customerQueueCallId;
      if (queueId) routingCallIdRef.current = queueId;
      teardownGuardRef.current = false;

      void syncBackendSession({
        customerPhone: dialUser,
        direction: 'outbound',
        transport: callTransport,
      });

      const target = sipDialUri(raw.startsWith('sip:') ? raw : dialUser);
      const ringingSession: CallSession = {
        id: queueId ?? randomId(),
        tenantId: user?.tenantId ?? '1',
        roomId: queueId ?? randomId(),
        channel: 'voice',
        agentLabel: 'BlinkOne Support',
        customerPhone: dialUser === 'blinkone' ? 'Support Agent' : dialUser,
        status: 'ringing',
        transport: callTransport,
        direction: 'outbound',
        startedAt: new Date().toISOString(),
      };
      setActiveCall(ringingSession);

      console.log('[JsSIP] outbound call', { target, dialUser });
      const outSession = ua.call(target, {
        mediaStream: localStream,
        mediaConstraints: { audio: true, video: false },
        rtcOfferConstraints: { offerToReceiveAudio: true },
        pcConfig: { iceServers: iceServersRef.current },
      });

      outSession.on('peerconnection', () => {
        void startCallAudio();
      });

      outSession.on('confirmed', () => {
        if (isAgentRef.current) setAgentState('busy');
        clearTimer();
        let sec = 0;
        timerRef.current = setInterval(() => {
          sec++;
          setCallDuration(sec);
        }, 1000);
        setActiveCall({
          ...ringingSession,
          status: 'connected',
          connectedAt: new Date().toISOString(),
        });
      });

      outSession.on('failed', (data: unknown) => {
        const cause = (data as { cause?: string })?.cause ?? 'unknown';
        console.warn('[JsSIP] outbound failed', cause);
        teardownRef.current({ sendBye: false, outcome: 'decline' });
      });

      outSession.on('ended', () => {
        teardownRef.current({ sendBye: false, outcome: 'hangup' });
      });

      sessionRef.current = outSession;
      return true;
    },
    [syncBackendSession, user, clearTimer, finishBackendCall, setActiveCall, setCallDuration, setAgentState],
  );

  const makePeerCall = useCallback(
    (targetAgentId: string) => {
      makeCall(targetAgentId.replace(/\D/g, ''), 'webrtc');
    },
    [makeCall],
  );

  const answerCall = useCallback(async () => {
    try {
      const stream = await prepareOutboundCallAudio();
      sessionRef.current?.answer({
        mediaStream: stream,
        mediaConstraints: { audio: true, video: false },
        pcConfig: { iceServers: iceServersRef.current },
      });
    } catch (e) {
      console.warn('[JsSIP] answer failed — no microphone', e);
    }
  }, []);

  const hangup = useCallback(() => {
    teardownRef.current({ sendBye: true, outcome: 'hangup' });
  }, []);

  const declineCall = useCallback(() => {
    teardownRef.current({ sendBye: true, outcome: 'decline' });
  }, []);

  const mute = useCallback(() => {
    sessionRef.current?.mute({ audio: true });
    setMuted(true);
  }, [setMuted]);

  const unmute = useCallback(() => {
    sessionRef.current?.unmute({ audio: true });
    setMuted(false);
  }, [setMuted]);

  const hold = useCallback(async () => {
    await sessionRef.current?.hold();
    setOnHold(true);
  }, [setOnHold]);

  const unhold = useCallback(async () => {
    await sessionRef.current?.unhold();
    setOnHold(false);
  }, [setOnHold]);

  const sendDtmf = useCallback((digit: string) => {
    sessionRef.current?.sendDTMF?.(digit);
  }, []);

  return { makeCall, makePeerCall, answerCall, hangup, declineCall, mute, unmute, hold, unhold, sendDtmf };
}
