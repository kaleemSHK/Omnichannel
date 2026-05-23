/**
 * useJsSip — WebRTC SIP hook for PSTN calling via Asterisk.
 *
 * Fetches WebRTC credentials from routing-service (/v1/agents/:id/webrtc),
 * registers with Asterisk via JsSIP over WSS, exposes call controls.
 *
 * Phase 0 requirement: nginx must proxy /telephony/wss → Asterisk:8089/ws
 * (already in nginx.conf as of the revised plan).
 */

'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '@/lib/store/auth';
import { useCallsStore } from '@/lib/store/calls';
import { getWebRTCCredentials } from '@/lib/api/routing';

// JsSIP types — loaded dynamically to avoid SSR issues
type JsSIPUA = {
  start(): void;
  stop(): void;
  call(target: string, options: Record<string, unknown>): JsSIPSession;
  on(event: string, handler: (...args: unknown[]) => void): void;
  isRegistered(): boolean;
};

type JsSIPSession = {
  answer(options?: Record<string, unknown>): void;
  terminate(): void;
  hold(): void;
  unhold(): void;
  mute(): void;
  unmute(): void;
  on(event: string, handler: (...args: unknown[]) => void): void;
};

export function useJsSip() {
  const { user } = useAuthStore();
  const { setSipRegistered, setSipError, setActiveCall, setAgentState } = useCallsStore();
  const ua = useRef<JsSIPUA | null>(null);
  const currentSession = useRef<JsSIPSession | null>(null);

  const initJsSip = useCallback(async () => {
    if (!user || typeof window === 'undefined') return;

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const JsSIP = require('jssip');
      const creds = await getWebRTCCredentials(String(user.id));

      const socket = new JsSIP.WebSocketInterface(creds.wsUri);

      const uaConfig = {
        sockets: [socket],
        uri: creds.sipUri,
        password: creds.password,
        register: true,
        pcConfig: {
          iceServers: [
            ...creds.stunServers.map((s: string) => ({ urls: s })),
            ...creds.turnServers,
          ],
        },
      };

      ua.current = new JsSIP.UA(uaConfig);

      ua.current!.on('registered', () => {
        setSipRegistered(true);
        setSipError(null);
        setAgentState('available');
      });

      ua.current!.on('unregistered', () => {
        setSipRegistered(false);
        setAgentState('offline');
      });

      ua.current!.on('registrationFailed', (e: unknown) => {
        setSipRegistered(false);
        setSipError(`SIP registration failed: ${String(e)}`);
      });

      // Incoming call
      ua.current!.on('newRTCSession', (raw: unknown) => {
        const { session } = raw as { session: JsSIPSession; request: unknown };
        currentSession.current = session;

        session.on('ended', () => {
          setActiveCall(null);
          setAgentState('available');
        });

        session.on('failed', () => {
          setActiveCall(null);
          setAgentState('available');
        });
      });

      ua.current!.start();
    } catch (err) {
      setSipError(`JsSIP init failed: ${String(err)}`);
    }
  }, [user, setSipRegistered, setSipError, setActiveCall, setAgentState]);

  useEffect(() => {
    initJsSip();
    return () => {
      ua.current?.stop();
      ua.current = null;
    };
  }, [initJsSip]);

  const makeCall = useCallback(
    (destination: string) => {
      if (!ua.current?.isRegistered()) {
        setSipError('SIP not registered — cannot make call');
        return;
      }
      const session = ua.current.call(`sip:${destination}`, {
        mediaConstraints: { audio: true, video: false },
      });
      currentSession.current = session;
    },
    [setSipError],
  );

  const answerCall = useCallback(() => {
    currentSession.current?.answer({ mediaConstraints: { audio: true, video: false } });
  }, []);

  const hangup = useCallback(() => {
    currentSession.current?.terminate();
    currentSession.current = null;
    setActiveCall(null);
  }, [setActiveCall]);

  const hold = useCallback(() => currentSession.current?.hold(), []);
  const unhold = useCallback(() => currentSession.current?.unhold(), []);
  const mute = useCallback(() => currentSession.current?.mute(), []);
  const unmute = useCallback(() => currentSession.current?.unmute(), []);

  return { makeCall, answerCall, hangup, hold, unhold, mute, unmute };
}
