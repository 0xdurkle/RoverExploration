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

interface Biome {
  id: string
  name: string
}

const RarityEditor = () => {
  const [items, setItems] = useState<Item[]>([])
  const [selectedItem, setSelectedItem] = useState<Item | null>(null)
  const [rarityValue, setRarityValue] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [biomes, setBiomes] = useState<Biome[]>([])

  // Edit fields for the currently selected item
  const [editName, setEditName] = useState('')
  const [editRarity, setEditRarity] = useState('uncommon')
  const [editBiomeId, setEditBiomeId] = useState('')

  // New item form
  const [newName, setNewName] = useState('')
  const [newRarity, setNewRarity] = useState('uncommon')
  const [newBiomeId, setNewBiomeId] = useState('')
  const [newBaseProbability, setNewBaseProbability] = useState(0.01)
  const [creating, setCreating] = useState(false)
  const [createStatus, setCreateStatus] = useState<'idle' | 'success' | 'error'>('idle')

  useEffect(() => {
    fetchItems()
    fetchBiomes()
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

  const fetchBiomes = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/biomes`)
      if (!res.ok) return
      const data = await res.json()
      const mapped: Biome[] = Array.isArray(data.biomes)
        ? data.biomes.map((b: any) => ({ id: b.id, name: b.name }))
        : []
      setBiomes(mapped)
    } catch (error) {
      console.error('Error fetching biomes:', error)
    }
  }

  const handleItemSelect = (itemName: string) => {
    const item = items.find((i) => i.name === itemName)
    if (item) {
      setSelectedItem(item)
      setRarityValue(item.baseProbability)
      setSaveStatus('idle')
      setEditName(item.name)
      setEditRarity(item.rarity)
      setEditBiomeId(item.biomeId)
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
      const res = await fetch(
        `${API_BASE_URL}/api/items/${encodeURIComponent(selectedItem.name)}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: editName,
            rarity: editRarity,
            baseProbability: rarityValue,
            biomeId: editBiomeId,
          }),
        }
      )

      if (res.ok) {
        const body = await res.json()
        const updatedItem: Item | null = body?.item
          ? {
              name: body.item.name,
              rarity: body.item.rarity,
              baseProbability: body.item.baseProbability,
              biome: body.item.biome,
              biomeId: body.item.biomeId,
            }
          : null

        setSaveStatus('success')
        // Update local state
        if (updatedItem) {
          setItems(
            items.map((item) =>
              item.name === selectedItem.name ? updatedItem : item
            )
          )
          setSelectedItem(updatedItem)
          setEditName(updatedItem.name)
          setEditRarity(updatedItem.rarity)
          setEditBiomeId(updatedItem.biomeId)
        } else {
          // Fallback: only update probability on the current selection
          setItems(
            items.map((item) =>
              item.name === selectedItem.name
                ? { ...item, baseProbability: rarityValue }
                : item
            )
          )
          setSelectedItem({ ...selectedItem, baseProbability: rarityValue })
        }
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

  const handleCreateItem = async () => {
    if (!newName || !newBiomeId) return
    setCreating(true)
    setCreateStatus('idle')

    try {
      const res = await fetch(
        `${API_BASE_URL}/api/biomes/${encodeURIComponent(newBiomeId)}/items`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: newName,
            rarity: newRarity,
            baseProbability: newBaseProbability,
          }),
        }
      )

      if (res.ok) {
        const body = await res.json()
        const created: Item | null = body?.item
          ? {
              name: body.item.name,
              rarity: body.item.rarity,
              baseProbability: body.item.baseProbability,
              biome: body.item.biome,
              biomeId: body.item.biomeId,
            }
          : null

        if (created) {
          setItems([...items, created])
        }
        setNewName('')
        setNewBaseProbability(0.01)
        setCreateStatus('success')
        setTimeout(() => setCreateStatus('idle'), 2000)
      } else {
        setCreateStatus('error')
        setTimeout(() => setCreateStatus('idle'), 3000)
      }
    } catch (error) {
      console.error('Error creating item:', error)
      setCreateStatus('error')
      setTimeout(() => setCreateStatus('idle'), 3000)
    } finally {
      setCreating(false)
    }
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
                <span className="info-value">
                  {biomes.find((b) => b.id === editBiomeId)?.name || selectedItem.biome}
                </span>
              </div>
              <div className="info-row">
                <span className="info-label">Current Rarity:</span>
                <span className="info-value rarity-badge" data-rarity={editRarity}>
                  {editRarity}
                </span>
              </div>
              <div className="info-row">
                <span className="info-label">Current Probability:</span>
                <span className="info-value">
                  {formatProbability(selectedItem.baseProbability)}
                </span>
              </div>
              <div className="info-row">
                <span className="info-label">Edit Name:</span>
                <input
                  type="text"
                  className="rarity-input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>
              <div className="info-row">
                <span className="info-label">Edit Rarity:</span>
                <select
                  className="item-select"
                  value={editRarity}
                  onChange={(e) => setEditRarity(e.target.value)}
                >
                  <option value="uncommon">Uncommon</option>
                  <option value="rare">Rare</option>
                  <option value="epic">Epic</option>
                  <option value="legendary">Legendary</option>
                </select>
              </div>
              <div className="info-row">
                <span className="info-label">Edit Biome:</span>
                <select
                  className="item-select"
                  value={editBiomeId}
                  onChange={(e) => setEditBiomeId(e.target.value)}
                >
                  <option value="">-- Select biome --</option>
                  {biomes.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
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
              <p>Select an item from the dropdown to edit its details and rarity.</p>
            </div>
          )}
        </div>
      </div>

      <div className="rarity-editor-create">
        <h3>Create New Item</h3>
        <div className="create-grid">
          <div className="create-field">
            <label className="rarity-label">Name</label>
            <input
              type="text"
              className="rarity-input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>
          <div className="create-field">
            <label className="rarity-label">Rarity</label>
            <select
              className="item-select"
              value={newRarity}
              onChange={(e) => setNewRarity(e.target.value)}
            >
              <option value="uncommon">Uncommon</option>
              <option value="rare">Rare</option>
              <option value="epic">Epic</option>
              <option value="legendary">Legendary</option>
            </select>
          </div>
          <div className="create-field">
            <label className="rarity-label">Biome</label>
            <select
              className="item-select"
              value={newBiomeId}
              onChange={(e) => setNewBiomeId(e.target.value)}
            >
              <option value="">-- Select biome --</option>
              {biomes.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div className="create-field">
            <label className="rarity-label">
              Base Probability: {formatProbability(newBaseProbability)}
            </label>
            <div className="rarity-input-group">
              <input
                type="range"
                min="0"
                max="1"
                step="0.0001"
                value={newBaseProbability}
                onChange={(e) => setNewBaseProbability(parseFloat(e.target.value))}
                className="rarity-slider"
              />
              <input
                type="number"
                min="0"
                max="1"
                step="0.0001"
                value={newBaseProbability}
                onChange={(e) => setNewBaseProbability(parseFloat(e.target.value))}
                className="rarity-input"
              />
            </div>
          </div>
        </div>
        <div className="rarity-actions">
          <button
            onClick={handleCreateItem}
            disabled={
              creating || !newName || !newBiomeId || Number.isNaN(newBaseProbability)
            }
            className="save-button"
          >
            {creating ? 'Creating...' : 'Create Item'}
          </button>
          {createStatus === 'success' && (
            <span className="save-status success">✓ Item created!</span>
          )}
          {createStatus === 'error' && (
            <span className="save-status error">✗ Error creating item.</span>
          )}
        </div>
      </div>
    </div>
  )
}

export default RarityEditor

