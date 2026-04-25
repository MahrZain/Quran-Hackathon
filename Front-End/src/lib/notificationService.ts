/**
 * NotificationService — Minimalist Web Notification management for ASAR Sanctuary.
 */

export const NOTIFICATION_MESSAGES = {
  REMINDER_TITLE: 'ASAR: Your 60-second Sanctuary',
  REMINDER_BODY: 'Your heart is waiting. 1% > 0% — it only takes 60 seconds to reflect today.',
}

const LAST_NOTIFIED_KEY = 'asar_last_motivation_date'

export class NotificationService {
  static async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) return false
    
    if (Notification.permission === 'granted') return true
    
    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission()
      return permission === 'granted'
    }
    
    return false
  }

  static async sendMotivation(): Promise<void> {
    const today = new Date().toISOString().split('T')[0]
    const lastNotified = localStorage.getItem(LAST_NOTIFIED_KEY)
    
    // Only notify once per day across all sessions
    if (lastNotified === today) return
    
    const granted = await this.requestPermission()
    if (!granted) return

    try {
      localStorage.setItem(LAST_NOTIFIED_KEY, today)
      const sw = await navigator.serviceWorker.ready
      if (sw && 'showNotification' in sw) {
        await sw.showNotification(NOTIFICATION_MESSAGES.REMINDER_TITLE, {
          body: NOTIFICATION_MESSAGES.REMINDER_BODY,
          icon: '/icon-192.svg',
          badge: '/icon-192.svg',
          tag: 'asar-daily-reminder',
        })
      } else {
        new Notification(NOTIFICATION_MESSAGES.REMINDER_TITLE, {
          body: NOTIFICATION_MESSAGES.REMINDER_BODY,
          icon: '/icon-192.svg',
        })
      }
    } catch (e) {
      new Notification(NOTIFICATION_MESSAGES.REMINDER_TITLE, {
        body: NOTIFICATION_MESSAGES.REMINDER_BODY,
        icon: '/icon-192.svg',
      })
    }
  }

  /** 
   * Groundwork for background notifications (Push API).
   * Professionally register a push subscription if requested.
   */
  static async registerPush(): Promise<void> {
    try {
      const sw = await navigator.serviceWorker.ready
      if (sw.pushManager) {
        const subscription = await sw.pushManager.subscribe({
          userVisibleOnly: true,
          // applicationServerKey: <VAPID_PUBLIC_KEY>
        })
        console.log('Push subscription ready:', subscription)
        // Here you would send 'subscription' to your backend
      }
    } catch (e) {
      console.warn('Push registration failed or not supported')
    }
  }

  static async checkAndNotify(todayCount: number): Promise<void> {
    // Only notify if they have done 0 ayahs today
    if (todayCount === 0) {
      await this.sendMotivation()
    }
  }
}
