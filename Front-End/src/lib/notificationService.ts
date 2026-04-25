/**
 * NotificationService — Minimalist Web Notification management for ASAR Sanctuary.
 */

export const NOTIFICATION_MESSAGES = {
  REMINDER_TITLE: 'ASAR: Your 60-second Sanctuary',
  REMINDER_BODY: 'Your heart is waiting. 1% > 0% — it only takes 60 seconds to reflect today.',
}

let sessionNotified = false

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
    if (sessionNotified) return
    
    const granted = await this.requestPermission()
    if (!granted) return

    try {
      sessionNotified = true
      const sw = await navigator.serviceWorker.ready
      if (sw) {
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
      // Fallback to standard notification if SW fails
      new Notification(NOTIFICATION_MESSAGES.REMINDER_TITLE, {
        body: NOTIFICATION_MESSAGES.REMINDER_BODY,
        icon: '/icon-192.svg',
      })
    }
  }

  static async checkAndNotify(todayCount: number): Promise<void> {
    // Only notify if they have done 0 ayahs today
    if (todayCount === 0) {
      await this.sendMotivation()
    }
  }
}
