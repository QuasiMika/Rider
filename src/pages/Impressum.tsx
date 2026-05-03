import './Impressum.css'

export default function Impressum() {
  return (
    <div className="impressum">
      <div className="impressum__inner">
        <h1 className="impressum__title">Impressum</h1>

        <section className="impressum__section">
          <h2>Angaben gemäß § 5 TMG</h2>
          <p>
            Rider GmbH<br />
            Rosgartenstraße 12<br />
            78462 Konstanz<br />
            Deutschland
          </p>
        </section>

        <section className="impressum__section">
          <h2>Vertreten durch</h2>
          <p>Max Mustermann (Geschäftsführer)</p>
        </section>

        <section className="impressum__section">
          <h2>Kontakt</h2>
          <p>
            Telefon: +49 7531 123 456<br />
            E-Mail: kontakt@rider-konstanz.de
          </p>
        </section>

        <section className="impressum__section">
          <h2>Registereintrag</h2>
          <p>
            Eingetragen im Handelsregister.<br />
            Registergericht: Amtsgericht Freiburg im Breisgau<br />
            Registernummer: HRB 123456
          </p>
        </section>

        <section className="impressum__section">
          <h2>Umsatzsteuer-ID</h2>
          <p>
            Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG:<br />
            DE 123 456 789
          </p>
        </section>

        <section className="impressum__section">
          <h2>Verantwortlich für den Inhalt (§ 18 Abs. 2 MStV)</h2>
          <p>
            Max Mustermann<br />
            Rosgartenstraße 12<br />
            78462 Konstanz
          </p>
        </section>

        <section className="impressum__section impressum__section--muted">
          <h2>Haftungsausschluss</h2>
          <p>
            Die Inhalte unserer Seiten wurden mit größter Sorgfalt erstellt. Für die Richtigkeit,
            Vollständigkeit und Aktualität der Inhalte können wir jedoch keine Gewähr übernehmen.
          </p>
        </section>
      </div>
    </div>
  )
}
