import type { Language } from "./language-context"

type Localized = { en: string; ru: string }

const DEMO_TEXT: Record<string, Localized> = {
  "Zaproponuj termin z listy oczekujących": { en: "Offer a slot from the waitlist", ru: "Предложить время из листа ожидания" },
  "Eskalacja: pacjentka zgłosiła reklamację": { en: "Escalation: patient filed a complaint", ru: "Эскалация: пациентка подала жалобу" },
  "Follow-up po wizycie — kontrola za tydzień": { en: "Post-visit follow-up — check-up in a week", ru: "Фоллоу-ап после визита — контроль через неделю" },
  "Kolejna próba kontaktu": { en: "Next contact attempt", ru: "Следующая попытка связаться" },
  "Oddzwoń po nieodebranym połączeniu": { en: "Call back after a missed call", ru: "Перезвонить после пропущенного звонка" },
  "Oddzwoń: potwierdź konsultację endodontyczną": { en: "Call back: confirm the endodontic consultation", ru: "Перезвонить: подтвердить эндодонтическую консультацию" },
  "Odpowiedz na nową wiadomość i przypisz klinikę": { en: "Reply to the new message and assign a clinic", ru: "Ответить на новое сообщение и назначить клинику" },
  "Odpowiedz na pierwszą wiadomość Instagram": { en: "Reply to the first Instagram message", ru: "Ответить на первое сообщение в Instagram" },
  "Skontaktuj się z nowym lead Instagram": { en: "Contact the new Instagram lead", ru: "Связаться с новым лидом из Instagram" },
  "Zadzwoń: potwierdź termin konsultacji ortodontycznej": { en: "Call: confirm the orthodontic consultation date", ru: "Позвонить: подтвердить дату ортодонтической консультации" },
  "Zapytaj o budżet pacjenta": { en: "Ask about the patient's budget", ru: "Уточнить бюджет пациента" },
  "Zweryfikuj nieznany numer i utwórz kontakt": { en: "Verify the unknown number and create a contact", ru: "Проверить неизвестный номер и создать контакт" },
  "Cześć {{imię}}! Przypominamy o kontrolnej wizycie w naszej klinice. Odpowiedz TAK, aby potwierdzić.": { en: "Hi {{imię}}! A reminder about your check-up visit at our clinic. Reply YES to confirm.", ru: "Здравствуйте, {{imię}}! Напоминаем о контрольном визите в нашу клинику. Ответьте ДА, чтобы подтвердить." },
  "Dzień dobry {{imię}}, zwolnił się termin u dr. Yanushkevich. Zadzwoń, aby zarezerwować.": { en: "Hello {{imię}}, a slot with Dr. Yanushkevich has opened up. Call to book it.", ru: "Здравствуйте, {{imię}}, освободилось время у д-ра Янушкевич. Позвоните, чтобы записаться." },
  "@Daniel Wozniak pacjentka jest zniecierpliwiona czekaniem — możemy przyspieszyć?": { en: "@Daniel Wozniak the patient is getting impatient with the wait — can we speed this up?", ru: "@Daniel Wozniak пациентка теряет терпение из-за ожидания — можем ускорить?" },
  "Cześć! Jestem wirtualnym asystentem kliniki. Mogę przekazać aktualne informacje organizacyjne o wybielaniu i połączyć Cię z konsultantem.": { en: "Hi! I'm the clinic's virtual assistant. I can share current organizational information about whitening and connect you with a consultant.", ru: "Здравствуйте! Я виртуальный ассистент клиники. Могу сообщить актуальную организационную информацию об отбеливании и связать вас с консультантом." },
  "Cześć! Piszę pierwszy raz, chciałabym zapytać o ceny wybielania zębów 🦷": { en: "Hi! This is my first time writing — I'd like to ask about teeth whitening prices 🦷", ru: "Здравствуйте! Пишу впервые, хотела бы узнать цены на отбеливание зубов 🦷" },
  "Dzień dobry, potwierdzam zapis na konsultację.": { en: "Hello, I confirm my consultation booking.", ru: "Здравствуйте, подтверждаю запись на консультацию." },
  "Dzień dobry, przypominamy o kontakcie w sprawie planu leczenia.": { en: "Hello, a reminder about getting in touch regarding your treatment plan.", ru: "Здравствуйте, напоминаем о связи по поводу плана лечения." },
  "Dziękuję za wiadomość. Skontaktuję się z recepcją. (demo)": { en: "Thank you for your message. I will contact reception. (demo)", ru: "Спасибо за сообщение. Свяжусь с ресепшеном. (демо)" },
  "Nie odpowiada drugi dzień, próbujemy inny kanał.": { en: "No reply for the second day, trying another channel.", ru: "Не отвечает второй день, пробуем другой канал." },
  "Potwierdzamy wizytę na konsultację ogólną.": { en: "We confirm the visit for a general consultation.", ru: "Подтверждаем визит на общую консультацию." },
  "Potwierdziłem wizytę przez WhatsApp, pacjent jest gotowy.": { en: "I confirmed the visit via WhatsApp, the patient is ready.", ru: "Подтвердил визит через WhatsApp, пациент готов." },
  "Rozmowa z pacjentką, kwestia finansowa — zaproponować raty.": { en: "Conversation with the patient, financial concern — offer instalments.", ru: "Разговор с пациенткой, вопрос финансов — предложить рассрочку." },
  "Trzeba zadzwonić 30.09, zaproponować raty — pacjentka jest czuła na cenę.": { en: "Call on 30.09 and offer instalments — the patient is price-sensitive.", ru: "Нужно позвонить 30.09 и предложить рассрочку — пациентка чувствительна к цене." },
  "Zapisano na protetykę, dokumenty potwierdzone.": { en: "Booked for prosthetics, documents confirmed.", ru: "Записана на протезирование, документы подтверждены." },
}

const PATTERNS: Array<{ re: RegExp; en: (m: string[]) => string; ru: (m: string[]) => string }> = [
  { re: /^Kolejna próba kontaktu — (.+)$/, en: (m) => `Next contact attempt — ${m[1]}`, ru: (m) => `Следующая попытка связаться — ${m[1]}` },
]

/**
 * Demo records are seeded in Polish. Localize them only when rendering so the
 * stored data and anything a user typed stay untouched; unknown text is
 * returned as is.
 */
export function localizeDemoText(text: string | undefined | null, language: Language): string {
  if (!text) return text ?? ""
  if (language === "pl") return text
  const exact = DEMO_TEXT[text]
  if (exact) return exact[language]
  for (const { re, en, ru } of PATTERNS) {
    const match = re.exec(text)
    if (match) return (language === "en" ? en : ru)(match)
  }
  return text
}
