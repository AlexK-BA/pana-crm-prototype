'use client'

import Link from 'next/link'
import { useLanguage } from '@/lib/crm/language-context'

const COPY = {
  en: {
    environment: 'Demo environment', title: 'Demo Privacy Notice', updated: 'Last updated: 14 October 2026',
    fictionalTitle: 'Use fictional data only', fictional: 'This CRM is a product demonstration. Do not enter real patient identifiers, medical information, payment details, credentials, or other confidential data.',
    processesTitle: 'What the demo processes', processes: 'The interface uses fictional sample records and has no production clinical or CRM backend. Language and role preferences may be stored locally in your browser. The hosting provider may process technical information such as IP address, request time, browser type, errors, and security logs. Vercel Analytics may collect aggregated usage and performance measurements.',
    excludesTitle: 'What we do not do', excludes: 'We do not sell personal data and do not intentionally use this demo to collect patient, clinical, or lead information.',
    productionTitle: 'Production use', production: 'A production deployment requires a customer-specific privacy notice, data controller details, lawful bases, retention periods, subprocessors, security controls, and a process for data-subject requests.',
    back: 'Return to the demo',
  },
  pl: {
    environment: 'Środowisko demonstracyjne', title: 'Informacja o prywatności wersji demo', updated: 'Ostatnia aktualizacja: 14 października 2026',
    fictionalTitle: 'Używaj wyłącznie fikcyjnych danych', fictional: 'Ten CRM jest demonstracją produktu. Nie wpisuj prawdziwych identyfikatorów pacjentów, informacji medycznych, danych płatniczych, danych logowania ani innych informacji poufnych.',
    processesTitle: 'Jakie dane przetwarza demo', processes: 'Interfejs wykorzystuje fikcyjne rekordy przykładowe i nie ma produkcyjnego zaplecza klinicznego ani CRM. Preferencje języka i roli mogą być przechowywane lokalnie w przeglądarce. Dostawca hostingu może przetwarzać informacje techniczne, takie jak adres IP, czas żądania, typ przeglądarki, błędy i logi bezpieczeństwa. Vercel Analytics może gromadzić zagregowane pomiary użycia i wydajności.',
    excludesTitle: 'Czego nie robimy', excludes: 'Nie sprzedajemy danych osobowych i nie wykorzystujemy celowo tej wersji demo do zbierania danych pacjentów, danych klinicznych ani informacji o leadach.',
    productionTitle: 'Użycie produkcyjne', production: 'Wdrożenie produkcyjne wymaga informacji o prywatności właściwej dla klienta, danych administratora, podstaw prawnych, okresów retencji, listy podmiotów przetwarzających, zabezpieczeń oraz procesu obsługi praw osób, których dane dotyczą.',
    back: 'Wróć do demo',
  },
  ru: {
    environment: 'Демонстрационная среда', title: 'Уведомление о конфиденциальности демо', updated: 'Обновлено: 14 октября 2026 г.',
    fictionalTitle: 'Используйте только вымышленные данные', fictional: 'Эта CRM является демонстрацией продукта. Не вводите реальные идентификаторы пациентов, медицинские сведения, платёжные данные, учётные данные или другую конфиденциальную информацию.',
    processesTitle: 'Что обрабатывает демо', processes: 'Интерфейс использует вымышленные записи и не подключён к рабочей медицинской системе или CRM. Выбор языка и роли может сохраняться локально в браузере. Хостинг-провайдер может обрабатывать технические данные: IP-адрес, время запроса, тип браузера, ошибки и журналы безопасности. Vercel Analytics может собирать агрегированные показатели использования и производительности.',
    excludesTitle: 'Чего мы не делаем', excludes: 'Мы не продаём персональные данные и намеренно не используем это демо для сбора сведений о пациентах, клинических данных или данных лидов.',
    productionTitle: 'Использование в production', production: 'Для рабочего внедрения необходимы уведомление о конфиденциальности конкретного заказчика, данные контролёра, правовые основания, сроки хранения, список обработчиков, меры безопасности и процесс обработки запросов субъектов данных.',
    back: 'Вернуться в демо',
  },
  es: {
    environment: 'Entorno de demostración', title: 'Aviso de privacidad de la demo', updated: 'Última actualización: 14 de octubre de 2026',
    fictionalTitle: 'Utilice únicamente datos ficticios', fictional: 'Este CRM es una demostración del producto. No introduzca identificadores reales de pacientes, información médica, datos de pago, credenciales ni otra información confidencial.',
    processesTitle: 'Qué procesa la demo', processes: 'La interfaz utiliza registros ficticios y no dispone de un backend clínico o CRM de producción. Las preferencias de idioma y rol pueden almacenarse localmente en su navegador. El proveedor de alojamiento puede procesar información técnica como la dirección IP, la hora de la solicitud, el tipo de navegador, los errores y los registros de seguridad. Vercel Analytics puede recopilar métricas agregadas de uso y rendimiento.',
    excludesTitle: 'Qué no hacemos', excludes: 'No vendemos datos personales ni utilizamos intencionadamente esta demo para recopilar información de pacientes, datos clínicos o información de leads.',
    productionTitle: 'Uso en producción', production: 'Un despliegue en producción requiere un aviso de privacidad específico del cliente, los datos del responsable del tratamiento, las bases jurídicas, los períodos de conservación, los subencargados, los controles de seguridad y un proceso para atender los derechos de los interesados.',
    back: 'Volver a la demo',
  },
} as const

export default function PrivacyPage() {
  const { language } = useLanguage()
  const copy = COPY[language]
  return (
    <main className="min-h-screen bg-background px-5 py-12 text-foreground">
      <article className="mx-auto max-w-3xl space-y-6">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{copy.environment}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{copy.title}</h1>
          <p className="mt-3 text-muted-foreground">{copy.updated}</p>
        </div>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">{copy.fictionalTitle}</h2>
          <p className="leading-7 text-muted-foreground">{copy.fictional}</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">{copy.processesTitle}</h2>
          <p className="leading-7 text-muted-foreground">{copy.processes}</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">{copy.excludesTitle}</h2>
          <p className="leading-7 text-muted-foreground">{copy.excludes}</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">{copy.productionTitle}</h2>
          <p className="leading-7 text-muted-foreground">{copy.production}</p>
        </section>

        <Link className="inline-flex underline underline-offset-4" href={`/?lang=${language}`}>
          {copy.back}
        </Link>
      </article>
    </main>
  )
}
