
import { HashRouter, Routes, Route, Link } from 'react-router-dom'
import Help from './pages/Help'

function Home() {
  return (
    <div style={{ padding: '2rem', textAlign: 'left' }}>
      <Link to="/help">
        <button style={{
          fontFamily: 'var(--sans)',
          fontSize: '15px',
          padding: '8px 20px',
          borderRadius: '8px',
          border: '1px solid var(--border)',
          background: 'var(--code-bg)',
          color: 'var(--text-h)',
          cursor: 'pointer',
          marginBottom: '1.5rem',
          display: 'block',
        }}>
          Help →
        </button>
      </Link>
    </div>
  )
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/help" element={<Help />} />
      </Routes>
    </HashRouter>
  )
}
