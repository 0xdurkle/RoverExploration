import { useState, useEffect, useMemo, useRef } from 'react'
import './Dashboard.css'
import { API_BASE_URL } from '../config'

interface InventoryItem {
  name: string
  rarity: string
  biome: string
  found_at: string
}

interface Action {
  id: number
  userId: string
  biome: string
  durationHours: number
  startedAt: string
  endedAt: string
  itemFound: {
    name: string
    rarity: string
    biome: string
    found_at: string
  } | null
  createdAt: string
}

const ActionsDisplay = ({ 
  actions, 
  formatActionLog,
  isOpen,
  onToggle,
  onOpen
}: { 
  actions: Action[]
  formatActionLog: (action: Action) => string
  isOpen: boolean
  onToggle: () => void
  onOpen: () => void
}) => {
  const [flipUpward, setFlipUpward] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen && containerRef.current) {
      const checkPosition = () => {
        if (!containerRef.current) return
        
        const rect = containerRef.current.getBoundingClientRect()
        const spaceBelow = window.innerHeight - rect.bottom
        const spaceAbove = rect.top

        // Flip upward if there's more space above than below
        setFlipUpward(spaceAbove > spaceBelow)
      }
      
      checkPosition()
      window.addEventListener('scroll', checkPosition, true)
      window.addEventListener('resize', checkPosition)
      
      return () => {
        window.removeEventListener('scroll', checkPosition, true)
        window.removeEventListener('resize', checkPosition)
      }
    }
  }, [isOpen])

  const handleToggle = () => {
    if (!isOpen) {
      onOpen() // Notify parent that this dropdown is opening
    }
    onToggle()
  }

  if (actions.length === 0) {
    return <span className="empty-state">No actions</span>
  }

  return (
    <div className="actions-display" ref={containerRef}>
      <button
        className="actions-toggle"
        onClick={handleToggle}
        type="button"
      >
        <span className="actions-summary">
          {actions.length} Action{actions.length !== 1 ? 's' : ''}
        </span>
        <span className="actions-arrow">{isOpen ? (flipUpward ? '▲' : '▼') : '▶'}</span>
      </button>
      {isOpen && (
        <div 
          ref={dropdownRef}
          className={`actions-dropdown ${flipUpward ? 'dropdown-upward' : ''}`}
        >
          <div className="actions-list">
            {actions.map((action) => (
              <div key={action.id} className="action-item-row">
                <span className="action-text">{formatActionLog(action)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const InventoryDisplay = ({ 
  inventory,
  isOpen,
  onToggle,
  onOpen
}: { 
  inventory: InventoryItem[]
  isOpen: boolean
  onToggle: () => void
  onOpen: () => void
}) => {
  const [flipUpward, setFlipUpward] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen && containerRef.current) {
      const checkPosition = () => {
        if (!containerRef.current) return
        
        const rect = containerRef.current.getBoundingClientRect()
        const spaceBelow = window.innerHeight - rect.bottom
        const spaceAbove = rect.top

        // Flip upward if there's more space above than below
        setFlipUpward(spaceAbove > spaceBelow)
      }
      
      checkPosition()
      window.addEventListener('scroll', checkPosition, true)
      window.addEventListener('resize', checkPosition)
      
      return () => {
        window.removeEventListener('scroll', checkPosition, true)
        window.removeEventListener('resize', checkPosition)
      }
    }
  }, [isOpen])

  const handleToggle = () => {
    if (!isOpen) {
      onOpen() // Notify parent that this dropdown is opening
    }
    onToggle()
  }

  if (inventory.length === 0) {
    return <span className="empty-state">No items</span>
  }

  // Group items by name and count them
  const itemCounts = useMemo(() => {
    const counts = new Map<string, { item: InventoryItem; count: number }>()
    inventory.forEach((item) => {
      const key = item.name
      if (counts.has(key)) {
        counts.get(key)!.count++
      } else {
        counts.set(key, { item, count: 1 })
      }
    })
    return Array.from(counts.values()).sort((a, b) => {
      // Sort by rarity first, then by name
      const rarityOrder: Record<string, number> = {
        epic: 0,
        legendary: 1,
        rare: 2,
        uncommon: 3,
      }
      const rarityDiff = (rarityOrder[a.item.rarity] ?? 999) - (rarityOrder[b.item.rarity] ?? 999)
      if (rarityDiff !== 0) return rarityDiff
      return a.item.name.localeCompare(b.item.name)
    })
  }, [inventory])

  const totalItems = inventory.length

  const getRarityColor = (rarity: string) => {
    switch (rarity.toLowerCase()) {
      case 'epic':
        return '#ffd700'
      case 'legendary':
        return '#a855f7'
      case 'rare':
        return '#3b82f6'
      case 'uncommon':
        return '#22c55e'
      default:
        return '#dcddde'
    }
  }

  return (
    <div className="inventory-display" ref={containerRef}>
      <button
        className="inventory-toggle"
        onClick={handleToggle}
        type="button"
      >
        <span className="inventory-summary">
          {totalItems} Item{totalItems !== 1 ? 's' : ''}
        </span>
        <span className="inventory-arrow">{isOpen ? (flipUpward ? '▲' : '▼') : '▶'}</span>
      </button>
      {isOpen && (
        <div 
          ref={dropdownRef}
          className={`inventory-dropdown ${flipUpward ? 'dropdown-upward' : ''}`}
        >
          <div className="inventory-list">
            {itemCounts.map(({ item, count }, idx) => (
              <div key={idx} className="inventory-item-row">
                <span
                  className="inventory-item-name"
                  style={{ color: getRarityColor(item.rarity) }}
                >
                  {item.name}
                </span>
                <span className="inventory-item-meta">
                  <span className="inventory-rarity">{item.rarity}</span>
                  {count > 1 && <span className="inventory-count">×{count}</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

interface User {
  discordId: string
  discordName: string
  walletAddress: string | null
  totalExplorations: number
  inventory: Array<{
    name: string
    rarity: string
    biome: string
    found_at: string
  }>
  lastActivity: string | null
  createdAt: string
}

interface Column {
  id: string
  label: string
  visible: boolean
}

const Dashboard = () => {
  const [users, setUsers] = useState<User[]>([])
  const [actions, setActions] = useState<Action[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  const [columns, setColumns] = useState<Column[]>([
    { id: 'discordName', label: 'Discord Name', visible: true },
    { id: 'walletAddress', label: 'Wallet Address', visible: true },
    { id: 'inventory', label: 'Inventory', visible: true },
    { id: 'actions', label: 'Action Logs', visible: true },
  ])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null) // Format: "userId-type" e.g., "123-inventory" or "123-actions"

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 5000) // Refresh every 5 seconds
    return () => clearInterval(interval)
  }, [])
  const fetchData = async () => {
    try {
      setError(null)

      const [usersRes, actionsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/users`),
        fetch(`${API_BASE_URL}/api/actions?limit=1000`),
      ])

      // Helper to extract detailed error message from API
      const extractError = async (res: Response, label: string) => {
        let details = ''
        try {
          const body = await res.json()
          if (body?.details) details = ` - ${body.details}`
          else if (body?.error && typeof body.error === 'string') {
            details = ` - ${body.error}`
          }
        } catch {
          // Ignore JSON parse errors; we'll fall back to status text
        }
        throw new Error(
          `${label} API error: ${res.status}${details || (res.statusText ? ` - ${res.statusText}` : '')}`
        )
      }

      if (!usersRes.ok) {
        await extractError(usersRes, 'Users')
      }
      if (!actionsRes.ok) {
        await extractError(actionsRes, 'Actions')
      }

      const usersData = await usersRes.json()
      const actionsData = await actionsRes.json()

      // Check if response is an error object
      if (usersData.error) {
        throw new Error(
          typeof usersData.error === 'string'
            ? usersData.error
            : 'Users API returned an error response'
        )
      }
      if (actionsData.error) {
        throw new Error(
          typeof actionsData.error === 'string'
            ? actionsData.error
            : 'Actions API returned an error response'
        )
      }

      setUsers(Array.isArray(usersData) ? usersData : [])
      setActions(Array.isArray(actionsData) ? actionsData : [])
      setLoading(false)
    } catch (error: any) {
      console.error('Error fetching data:', error)
      setError(error.message || 'Failed to fetch data')
      setUsers([])
      setActions([])
      setLoading(false)
    }
  }

  const getUserActions = (userId: string) => {
    return actions
      .filter((action) => action.userId === userId)
      .sort((a, b) => new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime())
  }

  const formatActionLog = (action: Action) => {
    if (!action.itemFound) {
      return `Explored ${action.biome} - No item found`
    }
    const date = new Date(action.endedAt)
    const timeStr = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
    return `Claimed ${action.itemFound.name} at ${timeStr}`
  }

  const filteredUsers = useMemo(() => {
    if (!searchTerm) return users
    const term = searchTerm.toLowerCase()
    return users.filter(
      (user) =>
        user.discordName.toLowerCase().includes(term) ||
        user.walletAddress?.toLowerCase().includes(term) ||
        user.inventory.some((item) => item.name.toLowerCase().includes(term))
    )
  }, [users, searchTerm])

  const toggleRowSelection = (userId: string) => {
    const newSelected = new Set(selectedRows)
    if (newSelected.has(userId)) {
      newSelected.delete(userId)
    } else {
      newSelected.add(userId)
    }
    setSelectedRows(newSelected)
  }

  const toggleColumnVisibility = (columnId: string) => {
    setColumns(
      columns.map((col) =>
        col.id === columnId ? { ...col, visible: !col.visible } : col
      )
    )
  }

  const exportToCSV = () => {
    const selectedUsers = selectedRows.size > 0
      ? filteredUsers.filter((u) => selectedRows.has(u.discordId))
      : filteredUsers

    const visibleColumns = columns.filter((col) => col.visible)
    const headers = visibleColumns.map((col) => col.label)

    const rows = selectedUsers.map((user) => {
      const userActions = getUserActions(user.discordId)
      return visibleColumns.map((col) => {
        switch (col.id) {
          case 'discordName':
            return user.discordName
          case 'walletAddress':
            return user.walletAddress || ''
          case 'inventory':
            return user.inventory
              .map((item) => `${item.name} (${item.rarity})`)
              .join('; ')
          case 'actions':
            return userActions.map(formatActionLog).join('; ')
          default:
            return ''
        }
      })
    })

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `rover-dashboard-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Status dots were previously inferred from last activity, but this was
  // often misleading. They've been removed from the UI to avoid confusion.

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Loading dashboard data...</p>
      </div>
    )
  }

  // Show error state if API failed
  if (error && !loading) {
    return (
      <div className="dashboard-error">
        <h3>Unable to load data</h3>
        <p>Please check that the API server is reachable at the configured URL.</p>
        <p>Error: {error}</p>
        <button onClick={fetchData} className="retry-button">Retry</button>
      </div>
    )
  }

  return (
    <div className="dashboard">
      <div className="dashboard-controls">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search by Discord name, wallet, or item..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        <div className="dashboard-actions">
          <div className="column-selector">
            <span>Columns:</span>
            {columns.map((col) => (
              <label key={col.id} className="checkbox-label">
                <input
                  type="checkbox"
                  checked={col.visible}
                  onChange={() => toggleColumnVisibility(col.id)}
                />
                {col.label}
              </label>
            ))}
          </div>
          <button onClick={exportToCSV} className="export-button">
            Export CSV
          </button>
        </div>
      </div>

      <div className="table-container">
        <table className="dashboard-table">
          <thead>
            <tr>
              <th className="checkbox-col">
                <input
                  type="checkbox"
                  checked={selectedRows.size === filteredUsers.length && filteredUsers.length > 0}
                  onChange={() => {
                    if (selectedRows.size === filteredUsers.length) {
                      setSelectedRows(new Set())
                    } else {
                      setSelectedRows(new Set(filteredUsers.map((u) => u.discordId)))
                    }
                  }}
                />
              </th>
              {columns.find((c) => c.id === 'discordName')?.visible && (
                <th>User</th>
              )}
              {columns.find((c) => c.id === 'walletAddress')?.visible && (
                <th>Wallet Address</th>
              )}
              {columns.find((c) => c.id === 'inventory')?.visible && (
                <th>Inventory</th>
              )}
              {columns.find((c) => c.id === 'actions')?.visible && (
                <th>Action Logs</th>
              )}
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => {
              const userActions = getUserActions(user.discordId)
              return (
                <tr key={user.discordId}>
                  <td className="checkbox-col">
                    <input
                      type="checkbox"
                      checked={selectedRows.has(user.discordId)}
                      onChange={() => toggleRowSelection(user.discordId)}
                    />
                  </td>
                  {columns.find((c) => c.id === 'discordName')?.visible && (
                    <td>
                      <div className="user-cell">
                        <span className="user-name">{user.discordName}</span>
                      </div>
                    </td>
                  )}
                  {columns.find((c) => c.id === 'walletAddress')?.visible && (
                    <td>
                      <code className="wallet-address">
                        {user.walletAddress || 'Not set'}
                      </code>
                    </td>
                  )}
                  {columns.find((c) => c.id === 'inventory')?.visible && (
                    <td>
                      <InventoryDisplay 
                        inventory={user.inventory}
                        isOpen={openDropdown === `${user.discordId}-inventory`}
                        onToggle={() => {
                          const key = `${user.discordId}-inventory`
                          setOpenDropdown(openDropdown === key ? null : key)
                        }}
                        onOpen={() => setOpenDropdown(`${user.discordId}-inventory`)}
                      />
                    </td>
                  )}
                  {columns.find((c) => c.id === 'actions')?.visible && (
                    <td>
                      <ActionsDisplay 
                        actions={userActions} 
                        formatActionLog={formatActionLog}
                        isOpen={openDropdown === `${user.discordId}-actions`}
                        onToggle={() => {
                          const key = `${user.discordId}-actions`
                          setOpenDropdown(openDropdown === key ? null : key)
                        }}
                        onOpen={() => setOpenDropdown(`${user.discordId}-actions`)}
                      />
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
        {filteredUsers.length === 0 && !loading && !error && (
          <div className="empty-table">
            <p>{searchTerm ? 'No users found matching your search.' : 'No users found. Start using the bot to see data here.'}</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default Dashboard

