import { useState, useEffect } from 'react'
import './RarityEditor.css'
import { API_BASE_URL } from '../config'

interface Item {
  name: string
  rarity: string
  baseProbability: number
  biome: string
  biomeId: string
}

const RarityEditor = () => {
  const [items, setItems] = useState<Item[]>([])
  const [selectedItem, setSelectedItem] = useState<Item | null>(null)
  const [rarityValue, setRarityValue] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')

  useEffect(() => {
    fetchItems()
  }, [])

  const fetchItems = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/items`)
      if (!res.ok) {
        throw new Error(`Items API error: ${res.status}`)
      }
      const data = await res.json()
      setItems(data)
      setLoading(false)
    } catch (error) {
      console.error('Error fetching items:', error)
      setLoading(false)
    }
  }

  const handleItemSelect = (itemName: string) => {
    const item = items.find((i) => i.name === itemName)
    if (item) {
      setSelectedItem(item)
      setRarityValue(item.baseProbability)
      setSaveStatus('idle')
    }
  }

  const handleRarityChange = (value: number) => {
    setRarityValue(value)
    setSaveStatus('idle')
  }

  const handleSave = async () => {
    if (!selectedItem) return

    setSaving(true)
    setSaveStatus('idle')

    try {
      const res = await fetch(`${API_BASE_URL}/api/items/${encodeURIComponent(selectedItem.name)}/rarity`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ baseProbability: rarityValue }),
      })

      if (res.ok) {
        setSaveStatus('success')
        // Update local state
        setItems(
          items.map((item) =>
            item.name === selectedItem.name
              ? { ...item, baseProbability: rarityValue }
              : item
          )
        )
        setSelectedItem({ ...selectedItem, baseProbability: rarityValue })
        setTimeout(() => setSaveStatus('idle'), 2000)
      } else {
        setSaveStatus('error')
        setTimeout(() => setSaveStatus('idle'), 3000)
      }
    } catch (error) {
      console.error('Error saving rarity:', error)
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 3000)
    } finally {
      setSaving(false)
    }
  }

  const formatProbability = (value: number) => {
    return `${(value * 100).toFixed(4)}%`
  }

  if (loading) {
    return (
      <div className="rarity-editor-loading">
        <div className="loading-spinner"></div>
        <p>Loading items...</p>
      </div>
    )
  }

  return (
    <div className="rarity-editor">
      <div className="rarity-editor-header">
        <h2>Item Rarity Editor</h2>
        <p className="rarity-editor-subtitle">
          Update base probability values for items. Changes are saved instantly.
        </p>
      </div>

      <div className="rarity-editor-content">
        <div className="rarity-editor-sidebar">
          <label className="rarity-label">Select Item</label>
          <select
            className="item-select"
            value={selectedItem?.name || ''}
            onChange={(e) => handleItemSelect(e.target.value)}
          >
            <option value="">-- Select an item --</option>
            {items.map((item) => (
              <option key={item.name} value={item.name}>
                {item.name} ({item.biome})
              </option>
            ))}
          </select>

          {selectedItem && (
            <div className="item-info">
              <div className="info-row">
                <span className="info-label">Biome:</span>
                <span className="info-value">{selectedItem.biome}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Current Rarity:</span>
                <span className="info-value rarity-badge" data-rarity={selectedItem.rarity}>
                  {selectedItem.rarity}
                </span>
              </div>
              <div className="info-row">
                <span className="info-label">Current Probability:</span>
                <span className="info-value">
                  {formatProbability(selectedItem.baseProbability)}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="rarity-editor-main">
          {selectedItem ? (
            <>
              <div className="rarity-controls">
                <div className="rarity-control-group">
                  <label className="rarity-control-label">
                    Base Probability: {formatProbability(rarityValue)}
                  </label>
                  <div className="rarity-input-group">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.0001"
                      value={rarityValue}
                      onChange={(e) => handleRarityChange(parseFloat(e.target.value))}
                      className="rarity-slider"
                    />
                    <input
                      type="number"
                      min="0"
                      max="1"
                      step="0.0001"
                      value={rarityValue}
                      onChange={(e) => handleRarityChange(parseFloat(e.target.value))}
                      className="rarity-input"
                    />
                  </div>
                </div>

                <div className="rarity-presets">
                  <span className="preset-label">Quick presets:</span>
                  <div className="preset-buttons">
                    <button
                      onClick={() => handleRarityChange(0.0025)}
                      className="preset-button"
                    >
                      0.25%
                    </button>
                    <button
                      onClick={() => handleRarityChange(0.01)}
                      className="preset-button"
                    >
                      1%
                    </button>
                    <button
                      onClick={() => handleRarityChange(0.04)}
                      className="preset-button"
                    >
                      4%
                    </button>
                    <button
                      onClick={() => handleRarityChange(0.08)}
                      className="preset-button"
                    >
                      8%
                    </button>
                  </div>
                </div>
              </div>

              <div className="rarity-actions">
                <button
                  onClick={handleSave}
                  disabled={saving || rarityValue === selectedItem.baseProbability}
                  className="save-button"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                {saveStatus === 'success' && (
                  <span className="save-status success">✓ Saved successfully!</span>
                )}
                {saveStatus === 'error' && (
                  <span className="save-status error">✗ Error saving. Please try again.</span>
                )}
              </div>
            </>
          ) : (
            <div className="rarity-editor-empty">
              <p>Select an item from the dropdown to edit its rarity.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default RarityEditor
