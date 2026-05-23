import { ref, onUnmounted } from 'vue';
import { useBlinkoneApi } from 'shared/blinkone/useBlinkoneApi';

const registered = ref(false);
const error = ref(null);
let ua = null;

export function useJsSipAgent(agentId) {
  const { routing, callingPstnEnabled } = useBlinkoneApi();

  async function connect() {
    if (!callingPstnEnabled.value || !agentId) return;
    error.value = null;
    try {
      const creds = await routing.webrtc(agentId);
      const JsSIP = window.JsSIP;
      if (!JsSIP) {
        error.value = 'JsSIP not loaded';
        return;
      }
      const socket = new JsSIP.WebSocketInterface(creds.wsUri);
      const configuration = {
        sockets: [socket],
        uri: creds.sipUri,
        password: creds.password,
        session_timers: false,
      };
      ua = new JsSIP.UA(configuration);
      ua.on('registered', () => {
        registered.value = true;
      });
      ua.on('registrationFailed', e => {
        error.value = e?.cause || 'registration failed';
        registered.value = false;
      });
      ua.start();
    } catch (e) {
      error.value = e.message;
    }
  }

  function disconnect() {
    if (ua) {
      ua.stop();
      ua = null;
    }
    registered.value = false;
  }

  onUnmounted(disconnect);

  return { registered, error, connect, disconnect, ua: () => ua };
}
