'use client'

import { useState, useMemo } from 'react'
import IccidBulkInputModal from '@/components/IccidBulkInputModal'
import { BulkSettingsModal, BulkSettings } from './bulk-settings-modal'

interface LineTagType {
  id: number
  code: string
  name: string
}

interface Line {
  id: string
  lineNumber: number
  simId?: string | null
  msisdn?: string | null
  status: string
  shippedAt?: string | null
  returnedAt?: string | null
  contractMonth?: string | null
  lineTagId?: number | null
  lineReserveTagId?: number | null
  lineTag?: LineTagType | null
  lineReserveTag?: LineTagType | null
}

interface PendingChange {
  simId?: string | null
  msisdn?: string | null
  lineTagId?: number | null
  lineReserveTagId?: number | null
  shippedAt?: string | null
  returnedAt?: string | null
  contractMonth?: string | null
  status?: string
}

interface LinesTableProps {
  applicationId: string
  lines: Line[]
  lineTags: LineTagType[]
  lineReserveTags: LineTagType[]
  onRefresh: () => void
}

const LINE_STATUS_LABELS: Record<string, string> = {
  NOT_ACTIVATED: '未開通',
  ACTIVATED: '開通済み',
  SHIPPED: '発送済み',
  RETURNED: '返却済み',
  CANCELLED: '解約',
}

type SortKey = 'msisdn' | 'simId' | 'lineTag' | 'lineReserveTag' | 'shippedAt' | 'returnedAt' | 'contractMonth' | 'status'

export function LinesTable({ applicationId, lines, lineTags, lineReserveTags, onRefresh }: LinesTableProps) {
  const [pendingChanges, setPendingChanges] = useState<Record<string, PendingChange>>({})
  const [selectedLines, setSelectedLines] = useState<Set<string>>(new Set())
  const [sortConfig, setSortConfig] = useState<{ key: SortKey | null; direction: 'asc' | 'desc' }>({ key: null, direction: 'asc' })
  const [isSaving, setIsSaving] = useState(false)
  const [showBulkSettingsModal, setShowBulkSettingsModal] = useState(false)
  const [showIccidBulkInputModal, setShowIccidBulkInputModal] = useState(false)

  const handleLineChange = (lineId: string, field: keyof PendingChange, value: string | number | null) => {
    setPendingChanges(prev => ({
      ...prev,
      [lineId]: { ...prev[lineId], [field]: value }
    }))
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getCurrentValue = (lineId: string, field: keyof PendingChange, originalValue: any) => {
    return pendingChanges[lineId]?.[field] !== undefined ? pendingChanges[lineId][field] : originalValue
  }

  const handleSort = (key: SortKey) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }))
  }

  const sortedLines = useMemo(() => {
    if (!sortConfig.key) return lines

    const sorted = [...lines].sort((a, b) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let aValue: any = null
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let bValue: any = null

      switch (sortConfig.key) {
        case 'msisdn': aValue = a.msisdn || ''; bValue = b.msisdn || ''; break
        case 'simId': aValue = a.simId || ''; bValue = b.simId || ''; break
        case 'lineTag': aValue = a.lineTag?.name || ''; bValue = b.lineTag?.name || ''; break
        case 'lineReserveTag': aValue = a.lineReserveTag?.name || ''; bValue = b.lineReserveTag?.name || ''; break
        case 'shippedAt': aValue = a.shippedAt || ''; bValue = b.shippedAt || ''; break
        case 'returnedAt': aValue = a.returnedAt || ''; bValue = b.returnedAt || ''; break
        case 'contractMonth': aValue = a.contractMonth || ''; bValue = b.contractMonth || ''; break
        case 'status': {
          const order: Record<string, number> = { NOT_ACTIVATED: 1, ACTIVATED: 2, SHIPPED: 3, RETURNED: 4, CANCELLED: 5 }
          return sortConfig.direction === 'asc'
            ? (order[a.status] || 999) - (order[b.status] || 999)
            : (order[b.status] || 999) - (order[a.status] || 999)
        }
        default: return 0
      }

      if (!aValue && bValue) return 1
      if (aValue && !bValue) return -1
      if (!aValue && !bValue) return 0

      return sortConfig.direction === 'asc'
        ? aValue.toString().localeCompare(bValue.toString(), 'ja')
        : bValue.toString().localeCompare(aValue.toString(), 'ja')
    })

    return sorted
  }, [lines, sortConfig])

  const handleSaveAll = async () => {
    setIsSaving(true)
    try {
      const updates = Object.entries(pendingChanges).map(([lineId, changes]) => ({
        id: lineId,
        ...changes
      }))

      const results = await Promise.all(
        updates.map(async (update) => {
          const { id: lineId, ...data } = update
          const response = await fetch(`/api/admin/lines/${lineId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          })
          return response.ok
        })
      )

      if (results.every(r => r)) {
        setPendingChanges({})
        onRefresh()
        alert('変更を保存しました')
      } else {
        alert('一部の変更の保存に失敗しました')
      }
    } catch (error) {
      console.error('保存エラー:', error)
      alert('保存に失敗しました')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancelAll = () => {
    setPendingChanges({})
    setSelectedLines(new Set())
  }

  const handleIccidBulkSave = async (assignments: { lineId: string; iccid: string; contractMonth?: string }[]) => {
    setIsSaving(true)
    try {
      const results = await Promise.all(
        assignments.map(async (assignment) => {
          const updateData: { simId: string; contractMonth?: string } = { simId: assignment.iccid }
          if (assignment.contractMonth) {
            updateData.contractMonth = assignment.contractMonth
          }
          const response = await fetch(`/api/admin/lines/${assignment.lineId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData),
          })
          return response.ok
        })
      )

      if (results.every(r => r)) {
        setPendingChanges({})
        onRefresh()
        alert(`${assignments.length}件のICCIDを保存しました`)
      } else {
        alert('一部のICCIDの保存に失敗しました')
      }
    } catch (error) {
      console.error('保存エラー:', error)
      alert('保存に失敗しました')
    } finally {
      setIsSaving(false)
    }
  }

  const handleBulkSettingsApply = (settings: BulkSettings) => {
    const fieldsToApply: Array<keyof BulkSettings> = []
    if (settings.lineTagId) fieldsToApply.push('lineTagId')
    if (settings.lineReserveTagId) fieldsToApply.push('lineReserveTagId')
    if (settings.shippedAt) fieldsToApply.push('shippedAt')
    if (settings.returnedAt) fieldsToApply.push('returnedAt')
    if (settings.contractMonth) fieldsToApply.push('contractMonth')
    if (settings.status) fieldsToApply.push('status')

    if (fieldsToApply.length === 0) {
      alert('設定する項目を選択してください')
      return
    }

    selectedLines.forEach(lineId => {
      fieldsToApply.forEach(field => {
        const value = settings[field]
        if (field === 'lineTagId' || field === 'lineReserveTagId') {
          handleLineChange(lineId, field as keyof PendingChange, value ? parseInt(value) : null)
        } else {
          handleLineChange(lineId, field as keyof PendingChange, value)
        }
      })
    })

    setShowBulkSettingsModal(false)
  }

  const SortHeader = ({ sortKey, label }: { sortKey: SortKey; label: string }) => (
    <th
      className="px-1 py-0.5 text-left text-[10px] font-semibold text-gray-700 border border-gray-300 cursor-pointer hover:bg-gray-200 select-none"
      onClick={() => handleSort(sortKey)}
    >
      {label} {sortConfig.key === sortKey && (sortConfig.direction === 'asc' ? '\u2191' : '\u2193')}
    </th>
  )

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="mb-4 flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-900">回線管理</h2>
        <button
          onClick={() => setShowIccidBulkInputModal(true)}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm font-medium"
        >
          ICCID連続入力
        </button>
      </div>

      {(Object.keys(pendingChanges).length > 0 || selectedLines.size > 0) && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
          <div className="flex gap-4">
            {Object.keys(pendingChanges).length > 0 && (
              <span className="text-sm font-semibold text-blue-800">
                {Object.keys(pendingChanges).length}件の変更があります
              </span>
            )}
            {selectedLines.size > 0 && (
              <span className="text-sm font-semibold text-blue-800">
                {selectedLines.size}件の回線を選択中
              </span>
            )}
          </div>
          <div className="flex gap-2">
            {selectedLines.size > 0 && (
              <button
                onClick={() => setShowBulkSettingsModal(true)}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm font-medium"
              >
                選択した回線を一括設定
              </button>
            )}
            {Object.keys(pendingChanges).length > 0 && (
              <>
                <button
                  onClick={handleCancelAll}
                  disabled={isSaving}
                  className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50 text-sm font-medium"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleSaveAll}
                  disabled={isSaving}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
                >
                  {isSaving ? '保存中...' : '保存'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse border border-gray-300">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-1 py-0.5 text-left text-[10px] font-semibold text-gray-700 border border-gray-300">
                <input
                  type="checkbox"
                  checked={sortedLines.length > 0 && selectedLines.size === sortedLines.length}
                  onChange={(e) => {
                    setSelectedLines(e.target.checked ? new Set(sortedLines.map(l => l.id)) : new Set())
                  }}
                  className="cursor-pointer"
                />
              </th>
              <SortHeader sortKey="msisdn" label="電話番号" />
              <SortHeader sortKey="simId" label="ICCID" />
              <SortHeader sortKey="lineTag" label="SIMの場所" />
              <SortHeader sortKey="lineReserveTag" label="予備タグ" />
              <SortHeader sortKey="shippedAt" label="発送日" />
              <SortHeader sortKey="returnedAt" label="返却日" />
              <SortHeader sortKey="contractMonth" label="契約月" />
              <SortHeader sortKey="status" label="ステータス" />
            </tr>
          </thead>
          <tbody className="bg-white">
            {sortedLines.map((line) => {
              const hasChanges = !!pendingChanges[line.id]
              const isSelected = selectedLines.has(line.id)

              return (
                <tr
                  key={line.id}
                  className={`${hasChanges ? 'bg-yellow-50' : ''} ${isSelected ? 'bg-blue-50' : ''} hover:bg-gray-50`}
                >
                  <td className="px-3 py-2 text-sm border border-gray-300">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {
                        const newSelected = new Set(selectedLines)
                        if (isSelected) newSelected.delete(line.id)
                        else newSelected.add(line.id)
                        setSelectedLines(newSelected)
                      }}
                      className="cursor-pointer"
                    />
                  </td>
                  <td className="px-3 py-2 text-sm border border-gray-300">
                    <input
                      type="text"
                      value={getCurrentValue(line.id, 'msisdn', line.msisdn) || ''}
                      onChange={(e) => handleLineChange(line.id, 'msisdn', e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-gray-900"
                      placeholder="電話番号"
                    />
                  </td>
                  <td className="px-3 py-2 text-sm border border-gray-300">
                    <input
                      type="text"
                      value={getCurrentValue(line.id, 'simId', line.simId) || ''}
                      onChange={(e) => handleLineChange(line.id, 'simId', e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-gray-900"
                      placeholder="ICCID"
                    />
                  </td>
                  <td className="px-3 py-2 text-sm border border-gray-300">
                    <select
                      value={getCurrentValue(line.id, 'lineTagId', line.lineTagId) ?? ''}
                      onChange={(e) => handleLineChange(line.id, 'lineTagId', e.target.value ? parseInt(e.target.value) : null)}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-gray-900"
                    >
                      <option value="">選択してください</option>
                      {lineTags.map((tag) => (
                        <option key={tag.id} value={tag.id}>{tag.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-sm border border-gray-300">
                    <select
                      value={getCurrentValue(line.id, 'lineReserveTagId', line.lineReserveTagId) ?? ''}
                      onChange={(e) => handleLineChange(line.id, 'lineReserveTagId', e.target.value ? parseInt(e.target.value) : null)}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-gray-900"
                    >
                      <option value="">選択してください</option>
                      {lineReserveTags.map((tag) => (
                        <option key={tag.id} value={tag.id}>{tag.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-sm border border-gray-300">
                    <input
                      type="date"
                      value={(() => {
                        const v = getCurrentValue(line.id, 'shippedAt', line.shippedAt)
                        return v ? new Date(v).toISOString().split('T')[0] : ''
                      })()}
                      onChange={(e) => handleLineChange(line.id, 'shippedAt', e.target.value || null)}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-gray-900"
                    />
                  </td>
                  <td className="px-3 py-2 text-sm border border-gray-300">
                    <input
                      type="date"
                      value={(() => {
                        const v = getCurrentValue(line.id, 'returnedAt', line.returnedAt)
                        return v ? new Date(v).toISOString().split('T')[0] : ''
                      })()}
                      onChange={(e) => handleLineChange(line.id, 'returnedAt', e.target.value || null)}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-gray-900"
                    />
                  </td>
                  <td className="px-3 py-2 text-sm border border-gray-300">
                    <input
                      type="month"
                      value={(() => {
                        const v = getCurrentValue(line.id, 'contractMonth', line.contractMonth)
                        return v ? new Date(v).toISOString().slice(0, 7) : ''
                      })()}
                      onChange={(e) => handleLineChange(line.id, 'contractMonth', e.target.value || null)}
                      className="w-32 px-2 py-1 border border-gray-300 rounded text-gray-900"
                    />
                  </td>
                  <td className="px-3 py-2 text-sm border border-gray-300">
                    <select
                      value={getCurrentValue(line.id, 'status', line.status)}
                      onChange={(e) => handleLineChange(line.id, 'status', e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-gray-900"
                    >
                      {Object.entries(LINE_STATUS_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <BulkSettingsModal
        isOpen={showBulkSettingsModal}
        onClose={() => setShowBulkSettingsModal(false)}
        lineTags={lineTags}
        lineReserveTags={lineReserveTags}
        onApply={handleBulkSettingsApply}
      />

      <IccidBulkInputModal
        isOpen={showIccidBulkInputModal}
        onClose={() => setShowIccidBulkInputModal(false)}
        lines={lines}
        onSave={handleIccidBulkSave}
      />
    </div>
  )
}
