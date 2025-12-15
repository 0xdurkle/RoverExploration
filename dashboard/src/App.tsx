import { useState } from 'react'
import Dashboard from './components/Dashboard'
import RarityEditor from './components/RarityEditor'
import './App.css'

function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'rarity'>('dashboard')

  return (
    <div className="app">
      <div className="app-header">
        <div className="header-title">
          <h1>Underlog Guide Dashboard</h1>
        </div>
        <nav className="header-nav">
          <button
            className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <span className="nav-icon">📊</span>
            <span>Dashboard</span>
          </button>
          <button
            className={`nav-item ${activeTab === 'rarity' ? 'active' : ''}`}
            onClick={() => setActiveTab('rarity')}
          >
            <span className="nav-icon">⚙️</span>
            <span>Rarity Editor</span>
          </button>
        </nav>
      </div>
      <div className="app-main">
        <div className="app-content">
          {activeTab === 'dashboard' ? <Dashboard /> : <RarityEditor />}
        </div>
      </div>
    </div>
  )
}

export default App
