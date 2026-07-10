export function useNotificationSound() {
  let audioCtx: AudioContext | null = null;

  function playBeep() {
    try {
      if (!audioCtx) {
        audioCtx = new AudioContext();
      }
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.value = 880;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + 0.15);
    } catch {
      // audio not available
    }
  }

  function notify(title: string, body?: string) {
    playBeep();
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body });
    }
  }

  return { notify, playBeep };
}
