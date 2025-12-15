import { useState } from 'react'
import Dashboard from './components/Dashboard'
import RarityEditor from './components/RarityEditor'
import ItemManager from './components/ItemManager'
import './App.css'

type TabId = 'dashboard' | 'rarity' | 'items'

function App() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard')

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
            <span className="nav-icon">🎯</span>
            <span>Rarity Editor</span>
          </button>
          <button
            className={`nav-item ${activeTab === 'items' ? 'active' : ''}`}
            onClick={() => setActiveTab('items')}
          >
            <span className="nav-icon">📦</span>
            <span>Item Manager</span>
          </button>
        </nav>
      </div>
      <div className="app-main">
        <div className="app-content">
          {activeTab === 'dashboard' && <Dashboard />}
          {activeTab === 'rarity' && <RarityEditor />}
          {activeTab === 'items' && <ItemManager />}
        </div>
      </div>
    </div>
  )
}

export default App

