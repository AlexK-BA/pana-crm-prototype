import type { ConversationControl, ConversationMode, Interaction } from "./entities"

export type ConversationReplyState = "new" | "awaiting" | "answered" | "bot" | "none"

export function interactionSenderKind(item?: Pick<Interaction, "direction" | "authorId" | "senderKind">) {
  if (item?.senderKind) return item.senderKind
  if (item?.authorId && /^bot(?:-|$)/i.test(item.authorId)) return "bot"
  if (item?.direction === "incoming") return "patient"
  return item?.direction === "outgoing" ? "user" : "system"
}

export function isBotInteraction(item?: Pick<Interaction, "direction" | "authorId" | "senderKind">) {
  return item?.direction === "outgoing" && interactionSenderKind(item) === "bot"
}

export function conversationReplyState(unread: number, last?: Pick<Interaction, "direction" | "authorId" | "senderKind">): ConversationReplyState {
  if (!last) return "none"
  if (unread > 0) return "new"
  if (last.direction === "incoming") return "awaiting"
  return isBotInteraction(last) ? "bot" : "answered"
}

const STATE_PRIORITY: ConversationReplyState[] = ["new", "awaiting", "bot", "answered", "none"]
export function worstConversationReplyState(states: ConversationReplyState[]) {
  return STATE_PRIORITY.find(state => states.includes(state)) ?? "none"
}

export function operatorCanSend(control: ConversationControl | undefined, actorId: string) {
  if (!control) return true
  if (control.mode === "closed" || control.mode === "bot_active" || control.mode === "bot_paused") return false
  return !control.ownerId || control.ownerId === actorId
}

export const CONVERSATION_MODE_LABELS: Record<ConversationMode, string> = {
  bot_active: "Bot aktywny",
  operator_active: "Operator prowadzi rozmowę",
  bot_paused: "Bot wstrzymany",
  closed: "Rozmowa zamknięta",
}
