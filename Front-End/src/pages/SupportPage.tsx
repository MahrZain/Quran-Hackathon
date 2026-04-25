import { Mail, MessageCircle, HelpCircle } from 'lucide-react'

export function SupportPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="text-center">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <HelpCircle className="h-8 w-8" />
        </div>
        <h1 className="mt-6 font-serif text-4xl font-bold text-primary">Support & Sanctuary Help</h1>
        <p className="mt-3 text-on-surface-variant">
          We are here to help you deepen your connection with the Quran.
        </p>
      </div>

      <div className="mt-12 grid gap-6">
        <div className="rounded-3xl border border-outline-variant/20 bg-surface-container-low p-8 shadow-ambient transition-all hover:border-primary/30">
          <div className="flex items-start gap-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-on-primary">
              <Mail className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-on-surface">Email Support</h2>
              <p className="mt-2 text-sm leading-relaxed text-on-surface/70">
                For account issues, technical bugs, or general inquiries about the ASAR Sanctuary.
              </p>
              <a 
                href="mailto:Hackathon@quran.com" 
                className="mt-4 inline-block text-lg font-semibold text-primary hover:underline"
              >
                Hackathon@quran.com
              </a>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-outline-variant/20 bg-surface-container-low p-8 shadow-ambient transition-all hover:border-primary/30">
          <div className="flex items-start gap-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-secondary text-on-secondary">
              <MessageCircle className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-on-surface">Community Reflection</h2>
              <p className="mt-2 text-sm leading-relaxed text-on-surface/70">
                Join our community to share reflections and learn from fellow travelers.
              </p>
              <a 
                href="https://discord.gg/SpEeJ5bWEQ" 
                target="_blank" 
                rel="noopener noreferrer"
                className="mt-4 inline-block rounded-full bg-surface-container-high px-6 py-2 text-sm font-bold text-primary transition hover:bg-primary hover:text-on-primary"
              >
                Join Discord Community
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-12 text-center text-xs text-on-surface-variant opacity-60">
        <p>&copy; 2026 ASAR Sanctuary. Build with humility and adab.</p>
      </div>
    </div>
  )
}
