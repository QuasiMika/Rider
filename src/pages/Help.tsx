import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import './Help.css'

export default function Help() {
  const [tableName, setTableName] = useState('todos')
  const [results, setResults] = useState<Record<string, unknown>[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const code = `import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'

export default function App() {
  const [rows, setRows] = useState([])

  useEffect(() => {
    async function fetchData() {
      const { data } = await supabase
        .from('${tableName}')
        .select()

      if (data) setRows(data)
    }
    fetchData()
  }, [])

  return (
    <ul>
      {rows.map((row, i) => (
        <li key={i}>{JSON.stringify(row)}</li>
      ))}
    </ul>
  )
}`

  async function runQuery() {
    setLoading(true)
    setError(null)
    setResults(null)
    const { data, error } = await supabase.from(tableName).select()
    if (error) setError(error.message)
    else setResults(data ?? [])
    setLoading(false)
  }

  return (
    <div className="help">
      <header className="help-header">
        <Link to="/" className="back-link">← Home</Link>
        <h1>Supabase + React</h1>
        <p>
          A guide to querying your{' '}
          <a href="https://supabase.com" target="_blank" rel="noreferrer">Supabase</a>
          {' '}tables from React. Run live queries against your project below.
        </p>
      </header>

      <section className="help-section">
        <h2>Query a table</h2>
        <p className="help-desc">
          Use <code>supabase.from(table).select()</code> to fetch all rows.
          Edit the table name — the code example updates live — then click{' '}
          <strong>Run</strong> to execute against your Supabase project.
        </p>

        <div className="table-name-row">
          <label htmlFor="table-name">Table name</label>
          <input
            id="table-name"
            value={tableName}
            onChange={e => setTableName(e.target.value)}
            spellCheck={false}
          />
        </div>

        <pre className="code-block"><code>{code}</code></pre>

        <button
          className="run-btn"
          onClick={runQuery}
          disabled={loading || !tableName.trim()}
        >
          {loading ? 'Running…' : 'Run query →'}
        </button>

        {error && (
          <div className="result-error">
            <strong>Error:</strong> {error}
          </div>
        )}

        {results && (
          <div className="result-block">
            <div className="result-meta">
              {results.length} row{results.length !== 1 ? 's' : ''} from <code>{tableName}</code>
            </div>
            <pre>{JSON.stringify(results, null, 2)}</pre>
          </div>
        )}
      </section>
    </div>
  )
}
