import type { Language } from "./language-context"

type Localized = { en: string; ru: string; es: string }

const DEMO_TEXT: Record<string, Localized> = {
  "Nierozpoznany kontakt": { en: "Unrecognized contact", ru: "Неизвестный контакт", es: "Contacto no identificado" },
  "Implantologia": { en: "Implantology", ru: "Имплантология", es: "Implantología" },
  "Endodoncja": { en: "Endodontics", ru: "Эндодонтия", es: "Endodoncia" },
  "Ortodoncja": { en: "Orthodontics", ru: "Ортодонтия", es: "Ortodoncia" },
  "Zaproponuj termin z listy oczekujących": { en: "Offer a slot from the waitlist", ru: "Предложить время из листа ожидания", es: "Proponer un horario de la lista de espera" },
  "Eskalacja: pacjentka zgłosiła reklamację": { en: "Escalation: patient filed a complaint", ru: "Эскалация: пациентка подала жалобу", es: "Escalamiento: la paciente presentó un reclamo" },
  "Follow-up po wizycie — kontrola za tydzień": { en: "Post-visit follow-up — check-up in a week", ru: "Фоллоу-ап после визита — контроль через неделю", es: "Seguimiento posterior a la cita: control en una semana" },
  "Kolejna próba kontaktu": { en: "Next contact attempt", ru: "Следующая попытка связаться", es: "Nuevo intento de contacto" },
  "Oddzwoń po nieodebranym połączeniu": { en: "Call back after a missed call", ru: "Перезвонить после пропущенного звонка", es: "Devolver la llamada tras una llamada perdida" },
  "Oddzwoń: potwierdź konsultację endodontyczną": { en: "Call back: confirm the endodontic consultation", ru: "Перезвонить: подтвердить эндодонтическую консультацию", es: "Devolver la llamada: confirmar la consulta de endodoncia" },
  "Odpowiedz na nową wiadomość i przypisz klinikę": { en: "Reply to the new message and assign a clinic", ru: "Ответить на новое сообщение и назначить клинику", es: "Responder al nuevo mensaje y asignar una clínica" },
  "Odpowiedz na pierwszą wiadomość Instagram": { en: "Reply to the first Instagram message", ru: "Ответить на первое сообщение в Instagram", es: "Responder al primer mensaje de Instagram" },
  "Skontaktuj się z nowym lead Instagram": { en: "Contact the new Instagram lead", ru: "Связаться с новым лидом из Instagram", es: "Contactar al nuevo lead de Instagram" },
  "Zadzwoń: potwierdź termin konsultacji ortodontycznej": { en: "Call: confirm the orthodontic consultation date", ru: "Позвонить: подтвердить дату ортодонтической консультации", es: "Llamar: confirmar la fecha de la consulta de ortodoncia" },
  "Zapytaj o budżet pacjenta": { en: "Ask about the patient's budget", ru: "Уточнить бюджет пациента", es: "Consultar el presupuesto del paciente" },
  "Zweryfikuj nieznany numer i utwórz kontakt": { en: "Verify the unknown number and create a contact", ru: "Проверить неизвестный номер и создать контакт", es: "Verificar el número desconocido y crear un contacto" },
  "Cześć {{imię}}! Przypominamy o kontrolnej wizycie w naszej klinice. Odpowiedz TAK, aby potwierdzić.": { en: "Hi {{imię}}! A reminder about your check-up visit at our clinic. Reply YES to confirm.", ru: "Здравствуйте, {{imię}}! Напоминаем о контрольном визите в нашу клинику. Ответьте ДА, чтобы подтвердить.", es: "¡Hola {{imię}}! Le recordamos su cita de control en nuestra clínica. Responda SÍ para confirmar." },
  "Dzień dobry {{imię}}, zwolnił się termin u dr. Yanushkevich. Zadzwoń, aby zarezerwować.": { en: "Hello {{imię}}, a slot with Dr. Yanushkevich has opened up. Call to book it.", ru: "Здравствуйте, {{imię}}, освободилось время у д-ра Янушкевич. Позвоните, чтобы записаться.", es: "Hola {{imię}}, se liberó un horario con la Dra. Yanushkevich. Llame para reservarlo." },
  "@Daniel Wozniak pacjentka jest zniecierpliwiona czekaniem — możemy przyspieszyć?": { en: "@Daniel Wozniak the patient is getting impatient with the wait — can we speed this up?", ru: "@Daniel Wozniak пациентка теряет терпение из-за ожидания — можем ускорить?", es: "@Daniel Wozniak la paciente se está impacientando por la espera: ¿podemos acelerar?" },
  "Cześć! Jestem wirtualnym asystentem kliniki. Mogę przekazać aktualne informacje organizacyjne o wybielaniu i połączyć Cię z konsultantem.": { en: "Hi! I'm the clinic's virtual assistant. I can share current organizational information about whitening and connect you with a consultant.", ru: "Здравствуйте! Я виртуальный ассистент клиники. Могу сообщить актуальную организационную информацию об отбеливании и связать вас с консультантом.", es: "¡Hola! Soy el asistente virtual de la clínica. Puedo compartir información organizativa actual sobre el blanqueamiento y ponerle en contacto con un asesor." },
  "Cześć! Piszę pierwszy raz, chciałabym zapytać o ceny wybielania zębów 🦷": { en: "Hi! This is my first time writing — I'd like to ask about teeth whitening prices 🦷", ru: "Здравствуйте! Пишу впервые, хотела бы узнать цены на отбеливание зубов 🦷", es: "¡Hola! Escribo por primera vez; quisiera consultar los precios del blanqueamiento dental 🦷" },
  "Dzień dobry, potwierdzam zapis na konsultację.": { en: "Hello, I confirm my consultation booking.", ru: "Здравствуйте, подтверждаю запись на консультацию.", es: "Buenos días, confirmo mi reserva de consulta." },
  "Dzień dobry, przypominamy o kontakcie w sprawie planu leczenia.": { en: "Hello, a reminder about getting in touch regarding your treatment plan.", ru: "Здравствуйте, напоминаем о связи по поводу плана лечения.", es: "Buenos días, le recordamos que nos pondremos en contacto por su plan de tratamiento." },
  "Dziękuję za wiadomość. Skontaktuję się z recepcją. (demo)": { en: "Thank you for your message. I will contact reception. (demo)", ru: "Спасибо за сообщение. Свяжусь с ресепшеном. (демо)", es: "Gracias por su mensaje. Me pondré en contacto con la recepción. (demo)" },
  "Nie odpowiada drugi dzień, próbujemy inny kanał.": { en: "No reply for the second day, trying another channel.", ru: "Не отвечает второй день, пробуем другой канал.", es: "Lleva dos días sin responder; probamos otro canal." },
  "Potwierdzamy wizytę na konsultację ogólną.": { en: "We confirm the visit for a general consultation.", ru: "Подтверждаем визит на общую консультацию.", es: "Confirmamos la cita para una consulta general." },
  "Potwierdziłem wizytę przez WhatsApp, pacjent jest gotowy.": { en: "I confirmed the visit via WhatsApp, the patient is ready.", ru: "Подтвердил визит через WhatsApp, пациент готов.", es: "Confirmé la cita por WhatsApp; el paciente está listo." },
  "Rozmowa z pacjentką, kwestia finansowa — zaproponować raty.": { en: "Conversation with the patient, financial concern — offer instalments.", ru: "Разговор с пациенткой, вопрос финансов — предложить рассрочку.", es: "Conversación con la paciente, tema financiero: ofrecer cuotas." },
  "Trzeba zadzwonić 30.09, zaproponować raty — pacjentka jest czuła na cenę.": { en: "Call on 30.09 and offer instalments — the patient is price-sensitive.", ru: "Нужно позвонить 30.09 и предложить рассрочку — пациентка чувствительна к цене.", es: "Hay que llamar el 30.09 y ofrecer cuotas: la paciente es sensible al precio." },
  "Zapisano na protetykę, dokumenty potwierdzone.": { en: "Booked for prosthetics, documents confirmed.", ru: "Записана на протезирование, документы подтверждены.", es: "Reservada para prótesis, documentos confirmados." },
}

const PATTERNS: Array<{ re: RegExp; en: (m: string[]) => string; ru: (m: string[]) => string; es: (m: string[]) => string }> = [
  { re: /^Kolejna próba kontaktu — (.+)$/, en: (m) => `Next contact attempt — ${m[1]}`, ru: (m) => `Следующая попытка связаться — ${m[1]}`, es: (m) => `Nuevo intento de contacto — ${m[1]}` },
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
  for (const pattern of PATTERNS) {
    const match = pattern.re.exec(text)
    if (match) return pattern[language](match)
  }
  return text
}
