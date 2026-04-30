import './Help.css'

const FAQS = [
  {
    q: 'Wie buche ich eine Fahrt?',
    a: 'Gib einfach deinen Start- und Zielort ein oder wähle eines der Schnellziele (z.B. Bahnhof oder Altstadt). Sobald beide Orte eingetragen sind, siehst du die geschätzte Strecke, Fahrtzeit und den Preis. Dann auf „Fahrer anfordern" tippen — fertig.',
  },
  {
    q: 'Was kostet eine Fahrt?',
    a: 'Der Preis berechnet sich automatisch aus der Streckenlänge: 2 € pro Kilometer (Mindestpreis 2 €). Die Schätzung wird dir schon vor der Buchung angezeigt.',
  },
  {
    q: 'Wie bezahle ich?',
    a: 'Nach der Fahrt kannst du direkt in der App per Karte bezahlen — sicher und einfach über Stripe. Bargeldzahlung direkt beim Fahrer ist ebenfalls möglich.',
  },
  {
    q: 'Wo fahrt ihr in Konstanz?',
    a: 'Wir sind in der gesamten Innenstadt unterwegs — vom Bahnhof durch die Altstadt bis zum Hafen und zur Universität. Auch Fahrten nach Kreuzlingen (CH) sind möglich.',
  },
  {
    q: 'Wie lange dauert es, bis ein Fahrer kommt?',
    a: 'In der App siehst du, wie viele Fahrer gerade online sind. Sobald ein Fahrer deine Anfrage annimmt, kannst du seinen Standort live auf der Karte verfolgen.',
  },
  {
    q: 'Was ist, wenn ich meinen Standort nicht eingeben möchte?',
    a: 'Du kannst deinen Startort manuell eintippen — du musst den GPS-Standort nicht freigeben. Praktisch für den Datenschutz.',
  },
  {
    q: 'Kann ich eine Fahrt stornieren?',
    a: 'Solange noch kein Fahrer akzeptiert hat, kannst du die Anfrage jederzeit abbrechen — einfach auf „Abbrechen" tippen.',
  },
  {
    q: 'Wie werde ich Fahrer?',
    a: 'Registriere dich und wähle bei der Profilerstellung die Rolle „Fahrer". Du siehst dann alle offenen Fahrtanfragen in deiner Nähe und kannst sie annehmen.',
  },
]

export default function Help() {
  return (
    <div className="help">
      <div className="help-hero">
        <div className="help-hero__icon">🛺</div>
        <h1>Häufige Fragen</h1>
        <p>Alles, was du über Rider in Konstanz wissen musst.</p>
      </div>

      <div className="help-faq">
        {FAQS.map((faq, i) => (
          <details key={i} className="help-faq__item">
            <summary className="help-faq__q">{faq.q}</summary>
            <p className="help-faq__a">{faq.a}</p>
          </details>
        ))}
      </div>

      <div className="help-contact">
        <div className="help-contact__icon">✉️</div>
        <h2>Noch Fragen?</h2>
        <p>Schreib uns — wir sind ein lokales Team aus Konstanz und helfen gerne weiter.</p>
        <a className="help-contact__link" href="mailto:hallo@rider-konstanz.de">
          hallo@rider-konstanz.de
        </a>
      </div>
    </div>
  )
}
