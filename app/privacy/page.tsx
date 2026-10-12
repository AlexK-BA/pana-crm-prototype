import Link from 'next/link'

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background px-5 py-12 text-foreground">
      <article className="mx-auto max-w-3xl space-y-6">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Demo environment</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Demo Privacy Notice</h1>
          <p className="mt-3 text-muted-foreground">Last updated: 12 October 2026</p>
        </div>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">Use fictional data only</h2>
          <p className="leading-7 text-muted-foreground">
            This CRM is a product demonstration. Do not enter real patient identifiers, medical information,
            payment details, credentials, or other confidential data.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">What the demo processes</h2>
          <p className="leading-7 text-muted-foreground">
            The interface uses fictional sample records and has no production clinical or CRM backend.
            Language and role preferences may be stored locally in your browser. The hosting provider may
            process technical information such as IP address, request time, browser type, errors, and security
            logs. Vercel Analytics may collect aggregated usage and performance measurements.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">What we do not do</h2>
          <p className="leading-7 text-muted-foreground">
            We do not sell personal data and do not intentionally use this demo to collect patient, clinical,
            or lead information.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">Production use</h2>
          <p className="leading-7 text-muted-foreground">
            A production deployment requires a customer-specific privacy notice, data controller details,
            lawful bases, retention periods, subprocessors, security controls, and a process for data-subject
            requests.
          </p>
        </section>

        <Link className="inline-flex underline underline-offset-4" href="/">
          Return to the demo
        </Link>
      </article>
    </main>
  )
}
