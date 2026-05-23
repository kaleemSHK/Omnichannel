import { ref } from 'vue';
import { useBlinkoneApi } from 'shared/blinkone/useBlinkoneApi';

export function useWhatsAppCall() {
  const { callingWhatsappEnabled } = useBlinkoneApi();
  const pc = ref(null);
  const status = ref('idle');

  async function startCall(callId) {
    if (!callingWhatsappEnabled.value) return;
    status.value = 'connecting';
    pc.value = new RTCPeerConnection();
    const res = await fetch(`/api/whatsapp-calls/v1/calls/${callId}/sdp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
    });
    const { sdp } = await res.json();
    if (sdp?.answer) {
      await pc.value.setRemoteDescription(sdp.answer);
      status.value = 'connected';
    }
  }

  function endCall() {
    pc.value?.close();
    pc.value = null;
    status.value = 'idle';
  }

  return { pc, status, startCall, endCall, callingWhatsappEnabled };
}
