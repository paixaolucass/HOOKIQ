/**
 * Sends a native browser notification.
 * Requests permission on first call — if denied, silently does nothing.
 */
export async function notifyDone(title: string, body?: string): Promise<void> {
  if (typeof window === 'undefined') return
  if (!('Notification' in window)) return

  if (Notification.permission === 'default') {
    await Notification.requestPermission()
  }

  if (Notification.permission !== 'granted') return

  // Don't notify if the tab is already focused
  if (document.visibilityState === 'visible') return

  new Notification(title, {
    body,
    icon: '/favicon.ico',
    silent: false,
  })
}
