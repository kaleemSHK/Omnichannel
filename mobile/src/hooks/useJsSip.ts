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
import { getWebRTCCredentials } from '@/api/routing';
import { SIP_WSS, SIP_DOMAIN, SIP_PASS, STUN, resolveSipWsUri } from '@/lib/env';
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
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const iceServersRef = useRef<RTCIceServer[]>([{ urls: STUN }]);

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
        return session;
      } catch (err) {
        console.warn('[JsSIP] backend session sync failed', err);
        return null;
      }
    },
    [tokens?.gatewayJwt, user],
  );

  const finishBackendCall = useCallback(async (outcome: 'hangup' | 'decline' = 'hangup') => {
    const id = backendSessionIdRef.current;
    backendSessionIdRef.current = null;
    if (!id) return;
    try {
      if (outcome === 'decline') await apiDeclineCall(id);
      else await apiHangupCall(id);
    } catch {
      /* CDR sync best-effort */
    }
  }, []);

  useEffect(() => {
    if (!installWebRtcGlobals()) return;

    let cancelled = false;

    (async () => {
      const prefs = await loadPrefs();
      const isAgent = prefs.role === 'agent';
      if (isAgent && !tokens?.gatewayJwt) return;

      let wssUrl = SIP_WSS;
      let sipUri = `sip:customer@${SIP_DOMAIN}`;
      let sipPassword = SIP_PASS;

      if (isAgent && user?.id) {
        try {
          const creds = await getWebRTCCredentials(String(user.id));
          wssUrl = resolveSipWsUri(creds.wsUri);
          sipUri = creds.sipUri;
          sipPassword = creds.password || SIP_PASS;
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

      if (!wssUrl || !sipPassword) return;

      try {
        const JsSIP = require('jssip');

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
          if (isAgent) setAgentState('available');
        });
        ua.on('unregistered', () => {
          setSipRegistered(false);
          if (isAgent) setAgentState('offline');
        });
        ua.on('registrationFailed', () => {
          setSipRegistered(false);
          if (isAgent) setAgentState('offline');
        });

        ua.on('newRTCSession', (data: unknown) => {
          const evt = data as {
            session: SipSession;
            originator: string;
            request?: { from?: { display_name?: string; uri?: { user?: string } } };
          };
          const { session, originator } = evt;
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
            });

            session.on('failed', () => {
              removeIncomingCall(incoming.callId);
              sessionRef.current = null;
              setActiveCall(null);
              if (isAgent) setAgentState('available');
              void finishBackendCall('decline');
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
                const s = await apiAnswerCall(backendId);
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
            sessionRef.current = null;
            setActiveCall(null);
            if (isAgent) setAgentState('available');
            setCallDuration(0);
            clearTimer();
            void finishBackendCall('hangup');
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
    (destination: string, transport: 'pstn' | 'webrtc' = 'pstn') => {
      const registered = uaRef.current?.isRegistered();
      console.log('[JsSIP] makeCall dest=', destination, 'uaRef=', !!uaRef.current, 'registered=', registered);
      if (!registered) { console.warn('[JsSIP] UA not registered, aborting call'); return; }
      const phone = destination.replace(/^sip:/, '').split('@')[0];
      void syncBackendSession({
        customerPhone: phone,
        direction: 'outbound',
        transport,
      });

      const target = destination.startsWith('sip:') ? destination : `sip:${destination}@${SIP_DOMAIN}`;
      const outSession = uaRef.current.call(target, {
        mediaConstraints: { audio: true, video: false },
        rtcOfferConstraints: { offerToReceiveAudio: true },
        pcConfig: { iceServers: iceServersRef.current },
      });
      // Reset calling state when outbound call fails or ends
      outSession.on('failed', () => {
        sessionRef.current = null;
        setActiveCall(null);  // triggers setCalling(false) in CustomerHome
      });
      outSession.on('ended', () => {
        sessionRef.current = null;
        setActiveCall(null);
        if (!isAgent) return;
        setAgentState('available');
      });
      sessionRef.current = outSession;
    },
    [syncBackendSession],
  );

  const makePeerCall = useCallback(
    (targetAgentId: string) => {
      makeCall(targetAgentId.replace(/\D/g, ''), 'webrtc');
    },
    [makeCall],
  );

  const answerCall = useCallback(() => {
    sessionRef.current?.answer({
      mediaConstraints: { audio: true, video: false },
      pcConfig: { iceServers: iceServersRef.current },
    });
  }, []);

  const hangup = useCallback(() => {
    sessionRef.current?.terminate();
    sessionRef.current = null;
    clearTimer();
    void finishBackendCall('hangup');
  }, [clearTimer, finishBackendCall]);

  const declineCall = useCallback(() => {
    sessionRef.current?.terminate();
    sessionRef.current = null;
    void finishBackendCall('decline');
  }, [finishBackendCall]);

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
