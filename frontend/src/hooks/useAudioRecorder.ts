'use client';

import { useCallback, useRef, useState } from 'react';

export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
  }, []);

  const startRecording = useCallback(async () => {
    if (isRecording) return;
    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      throw new Error('Audio recording is not supported in this browser');
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    chunksRef.current = [];

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : '';

    const recorder = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream);

    recorder.ondataavailable = e => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorderRef.current = recorder;
    recorder.start();
    setIsRecording(true);
  }, [isRecording]);

  const stopRecording = useCallback((): Promise<File | null> => {
    return new Promise(resolve => {
      const recorder = recorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        stopTracks();
        setIsRecording(false);
        resolve(null);
        return;
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        stopTracks();
        recorderRef.current = null;
        chunksRef.current = [];
        setIsRecording(false);

        if (!blob.size) {
          resolve(null);
          return;
        }

        const ext = blob.type.includes('ogg') ? 'ogg' : 'webm';
        resolve(new File([blob], `voice-${Date.now()}.${ext}`, { type: blob.type }));
      };

      recorder.stop();
    });
  }, [stopTracks]);

  const cancelRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = () => {
        chunksRef.current = [];
        recorderRef.current = null;
        stopTracks();
        setIsRecording(false);
      };
      recorder.stop();
      return;
    }
    stopTracks();
    setIsRecording(false);
  }, [stopTracks]);

  return {
    isRecording,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}
