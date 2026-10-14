"use client"

import Link from "next/link"
import { useLanguage } from "@/lib/crm/language-context"

const LABELS = {
  en: "Demo Privacy Notice",
  pl: "Informacja o prywatności wersji demo",
  ru: "Уведомление о конфиденциальности демо",
  es: "Aviso de privacidad de la demo",
} as const

export function PrivacyFooter() {
  const { language } = useLanguage()

  return (
    <footer className="border-t bg-background px-4 py-3 text-center text-xs text-muted-foreground">
      <Link className="underline underline-offset-4 hover:text-foreground" href={`/privacy?lang=${language}`}>
        {LABELS[language]}
      </Link>
    </footer>
  )
}
