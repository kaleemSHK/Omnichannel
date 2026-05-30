import InCallManager from 'react-native-incall-manager';

export async function setSpeakerphoneOn(enabled: boolean): Promise<void> {
  InCallManager.setForceSpeakerphoneOn(enabled);
  if (enabled) InCallManager.start({ media: 'audio' });
}

export async function startCallAudio(): Promise<void> {
  InCallManager.start({ media: 'audio' });
}

export async function stopCallAudio(): Promise<void> {
  InCallManager.stop();
}
