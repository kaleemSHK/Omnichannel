import { useEffect, useRef, useCallback } from 'react';
import { useCallsStore } from '@/store/calls';
import { useAuthStore } from '@/store/auth';
import { loadPrefs } from '@/lib/storage';
import { randomId } from '@/lib/uuid';
import { installWebRtcGlobals } from '@/lib/webrtc';
import { SIP_WSS, SIP_DOMAIN, SIP_PASS, STUN } from '@/lib/env';
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
  on(event: string, handler: (...args: unknown[]) => void): void;
}

export function useJsSip() {
  const uaRef = useRef<SipUA | null>(null);
  const sessionRef = useRef<SipSession | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  useEffect(() => {
    if (!SIP_WSS || !SIP_PASS) return;
    if (!installWebRtcGlobals()) return;

    let cancelled = false;

    (async () => {
      const prefs = await loadPrefs();
      const isAgent = prefs.role === 'agent';
      if (isAgent && !tokens?.gatewayJwt) return;

      try {
        const JsSIP = require('jssip');
        const sipUser = isAgent ? (user?.email?.split('@')[0] ?? 'agent') : 'customer';
        const sipUri = `sip:${sipUser}@${SIP_DOMAIN}`;

        const ua: SipUA = new (JsSIP as unknown as { UA: new (c: unknown) => SipUA }).UA({
          sockets: [
            new (JsSIP as unknown as { WebSocketInterface: new (url: string) => unknown }).WebSocketInterface(
              SIP_WSS,
            ),
          ],
          uri: sipUri,
          password: SIP_PASS,
          display_name: user?.name ?? sipUser,
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

          if (originator === 'remote') {
            const incoming = {
              callId: randomId(),
              callerName,
              callerNumber: callerNum,
              startedAt: new Date().toISOString(),
            };
            addIncomingCall(incoming);

            session.on('ended', () => {
              removeIncomingCall(incoming.callId);
              sessionRef.current = null;
              setActiveCall(null);
              if (isAgent) setAgentState('available');
              if (timerRef.current) clearInterval(timerRef.current);
            });

            session.on('failed', () => {
              removeIncomingCall(incoming.callId);
              sessionRef.current = null;
              setActiveCall(null);
              if (isAgent) setAgentState('available');
            });
          }

          session.on('confirmed', () => {
            if (isAgent) setAgentState('busy');
            let sec = 0;
            timerRef.current = setInterval(() => {
              sec++;
              setCallDuration(sec);
            }, 1000);

            const callSession: CallSession = {
              id: randomId(),
              tenantId: user?.tenantId ?? 'default',
              roomId: randomId(),
              channel: 'voice',
              agentLabel: user?.name ?? 'agent',
              customerPhone: callerNum,
              status: 'connected',
              transport: 'pstn',
              direction: originator === 'remote' ? 'inbound' : 'outbound',
              startedAt: new Date().toISOString(),
            };
            setActiveCall(callSession);
          });

          session.on('ended', () => {
            sessionRef.current = null;
            setActiveCall(null);
            if (isAgent) setAgentState('available');
            setCallDuration(0);
            if (timerRef.current) clearInterval(timerRef.current);
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
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [tokens?.gatewayJwt, user?.email, user?.name, user?.tenantId]);

  const makeCall = useCallback((destination: string) => {
    if (!uaRef.current?.isRegistered()) return;
    const target = destination.startsWith('sip:') ? destination : `sip:${destination}@${SIP_DOMAIN}`;
    sessionRef.current = uaRef.current.call(target, {
      mediaConstraints: { audio: true, video: false },
      rtcOfferConstraints: { offerToReceiveAudio: true },
      pcConfig: { iceServers: [{ urls: STUN }] },
    });
  }, []);

  const answerCall = useCallback(() => {
    sessionRef.current?.answer({
      mediaConstraints: { audio: true, video: false },
      pcConfig: { iceServers: [{ urls: STUN }] },
    });
  }, []);

  const hangup = useCallback(() => {
    sessionRef.current?.terminate();
    sessionRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
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

  return { makeCall, answerCall, hangup, mute, unmute, hold, unhold };
}
