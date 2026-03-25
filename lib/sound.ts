export function playDone() {
  if (typeof window === 'undefined') return
  try {
    const ctx = new AudioContext()
    const notes = [880, 1108.73, 1318.51] // A5 C#6 E6 — acorde limpo
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.value = freq
      const start = ctx.currentTime + i * 0.07
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.12, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.5)
      osc.start(start)
      osc.stop(start + 0.5)
    })
  } catch {
    // AudioContext não disponível — silêncio
  }
}
