import { Phone, Globe, MessageCircle, Send, User } from "lucide-react"
import type { ContactChannel } from "@/lib/crm/entities"
import { cn } from "@/lib/utils"

export type ChannelPlatform = Extract<ContactChannel, "instagram" | "telegram" | "whatsapp" | "website" | "phone"> | "internal"

const CONFIG: Record<ChannelPlatform, { icon: typeof Phone; className: string }> = {
  instagram: { icon: MessageCircle, className: "bg-gradient-to-br from-fuchsia-500 via-pink-500 to-amber-400 text-white" },
  telegram: { icon: Send, className: "bg-sky-500 text-white" },
  whatsapp: { icon: MessageCircle, className: "bg-emerald-500 text-white" },
  website: { icon: Globe, className: "bg-indigo-500 text-white" },
  phone: { icon: Phone, className: "bg-slate-500 text-white" },
  internal: { icon: User, className: "bg-teal-600 text-white" },
}

export function ChannelIcon({ platform, className }: { platform: ChannelPlatform; className?: string }) {
  const { icon: Icon, className: colorClass } = CONFIG[platform]
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center rounded-full p-1", colorClass, className)}>
      <Icon className="h-full w-full" strokeWidth={2.2} />
    </span>
  )
}
