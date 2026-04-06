'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'

// --- 型定義 ---

interface Tag {
  id: number
  name: string
}

interface Line {
  id: string
  lineNumber: number
  simId: string | null
  msisdn: string | null
  status: string
  shippedAt: string | null
  returnedAt: string | null
  contractMonth: string | null
  application: {
    id: string
    applicationNumber: string
    customer: {
      type: string
      lastName: string | null
      firstName: string | null
      companyName: string | null
      phone: string | null
    }
  }
  sim: {
    iccid: string
    msisdn: string | null
  } | null
  lineTag: Tag | null
  lineReserveTag: Tag | null
}

interface FilterConfig {
  applicantName: string
  companyName: string
  phoneNumber: string
  iccid: string
  lineTagIds: string[]
  lineReserveTagIds: string[]
  lineStatuses: string[]
  shippedAtFrom: string
  shippedAtTo: string
  returnedAtFrom: string
  returnedAtTo: string
}

interface PendingChange {
  msisdn?: string | null
  simId?: string | null
  lineTagId?: number | null
  lineReserveTagId?: number | null
  shippedAt?: string | null
  returnedAt?: string | null
  status?: string
}

const INITIAL_FILTER: FilterConfig = {
  applicantName: '',
  companyName: '',
  phoneNumber: '',
  iccid: '',
  lineTagIds: [],
  lineReserveTagIds: [],
  lineStatuses: [],
  shippedAtFrom: '',
  shippedAtTo: '',
  returnedAtFrom: '',
  returnedAtTo: '',
}

const LINE_STATUS_OPTIONS = [
  { value: 'NOT_ACTIVATED', label: '未開通' },
  { value: 'ACTIVATED', label: '開通済み' },
  { value: 'SHIPPED', label: '発送済み' },
  { value: 'WAITING_RETURN', label: '返却待ち' },
  { value: 'RETURNED', label: '返却済み' },
  { value: 'CANCELLED', label: '解約' },
]

const STATUS_SORT_ORDER: Record<string, number> = {
  NOT_ACTIVATED: 1,
  ACTIVATED: 2,
  SHIPPED: 3,
  WAITING_RETURN: 4,
  RETURNED: 5,
  CANCELLED: 6,
}

export default function LinesPage() {
  const [lines, setLines] = useState<Line[]>([])
  const [lineTags, setLineTags] = useState<Tag[]>([])
  const [lineReserveTags, setLineReserveTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [pendingChanges, setPendingChanges] = useState<Record<string, PendingChange>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [selectedLines, setSelectedLines] = useState<Set<string>>(new Set())
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [bulkSettings, setBulkSettings] = useState<Record<string, string>>({})
  const [sortConfig, setSortConfig] = useState<{ key: string | null; direction: 'asc' | 'desc' }>({ key: null, direction: 'asc' })
  const [filterConfig, setFilterConfig] = useState<FilterConfig>(INITIAL_FILTER)
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false)

  useEffect(() => {
    fetchLines()
    fetchTags()
  }, [])

  const fetchLines = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/lines?pageSize=9999')
      if (res.ok) {
        const data = await res.json()
        setLines(data.lines || data.data || [])
      }
    } catch (error) {
      console.error('回線一覧取得エラー:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchTags = async () => {
    try {
      const res = await fetch('/api/admin/tags')
      if (res.ok) {
        const data = await res.json()
        setLineTags(data.lineTags || [])
        setLineReserveTags(data.lineReserveTags || [])
      }
    } catch (error) {
      console.error('タグ取得エラー:', error)
    }
  }

  // --- フィルタ & ソート ---

  const hasActiveFilters = useMemo(() => {
    return (
      filterConfig.applicantName !== '' ||
      filterConfig.companyName !== '' ||
      filterConfig.phoneNumber !== '' ||
      filterConfig.iccid !== '' ||
      filterConfig.lineTagIds.length > 0 ||
      filterConfig.lineReserveTagIds.length > 0 ||
      filterConfig.lineStatuses.length > 0 ||
      filterConfig.shippedAtFrom !== '' ||
      filterConfig.shippedAtTo !== '' ||
      filterConfig.returnedAtFrom !== '' ||
      filterConfig.returnedAtTo !== ''
    )
  }, [filterConfig])

  const filteredAndSortedLines = useMemo(() => {
    let filtered = lines.filter((line) => {
      const c = line.application.customer

      if (filterConfig.applicantName) {
        const name = c.type === 'CORPORATE'
          ? (c.companyName || '')
          : `${c.lastName || ''}${c.firstName || ''}`
        if (!name.toLowerCase().includes(filterConfig.applicantName.toLowerCase())) return false
      }
      if (filterConfig.companyName) {
        if (!(c.companyName || '').toLowerCase().includes(filterConfig.companyName.toLowerCase())) return false
      }
      if (filterConfig.phoneNumber) {
        const msisdn = pendingChanges[line.id]?.msisdn !== undefined
          ? (pendingChanges[line.id].msisdn || '')
          : (line.msisdn || '')
        if (!msisdn.includes(filterConfig.phoneNumber)) return false
      }
      if (filterConfig.iccid) {
        const simId = pendingChanges[line.id]?.simId !== undefined
          ? (pendingChanges[line.id].simId || '')
          : (line.simId || '')
        if (!simId.includes(filterConfig.iccid)) return false
      }

      if (filterConfig.lineTagIds.length > 0) {
        const tagId = pendingChanges[line.id]?.lineTagId !== undefined
          ? pendingChanges[line.id].lineTagId
          : line.lineTag?.id
        if (filterConfig.lineTagIds.includes('__empty__')) {
          if (tagId != null && !filterConfig.lineTagIds.includes(String(tagId))) return false
        } else {
          if (tagId == null || !filterConfig.lineTagIds.includes(String(tagId))) return false
        }
      }

      if (filterConfig.lineReserveTagIds.length > 0) {
        const tagId = pendingChanges[line.id]?.lineReserveTagId !== undefined
          ? pendingChanges[line.id].lineReserveTagId
          : line.lineReserveTag?.id
        if (filterConfig.lineReserveTagIds.includes('__empty__')) {
          if (tagId != null && !filterConfig.lineReserveTagIds.includes(String(tagId))) return false
        } else {
          if (tagId == null || !filterConfig.lineReserveTagIds.includes(String(tagId))) return false
        }
      }

      if (filterConfig.lineStatuses.length > 0) {
        const status = pendingChanges[line.id]?.status || line.status
        if (!filterConfig.lineStatuses.includes(status)) return false
      }

      if (filterConfig.shippedAtFrom || filterConfig.shippedAtTo) {
        const date = pendingChanges[line.id]?.shippedAt !== undefined
          ? pendingChanges[line.id].shippedAt
          : line.shippedAt
        if (!date) return false
        const d = date.slice(0, 10)
        if (filterConfig.shippedAtFrom && d < filterConfig.shippedAtFrom) return false
        if (filterConfig.shippedAtTo && d > filterConfig.shippedAtTo) return false
      }

      if (filterConfig.returnedAtFrom || filterConfig.returnedAtTo) {
        const date = pendingChanges[line.id]?.returnedAt !== undefined
          ? pendingChanges[line.id].returnedAt
          : line.returnedAt
        if (!date) return false
        const d = date.slice(0, 10)
        if (filterConfig.returnedAtFrom && d < filterConfig.returnedAtFrom) return false
        if (filterConfig.returnedAtTo && d > filterConfig.returnedAtTo) return false
      }

      return true
    })

    if (sortConfig.key) {
      filtered = [...filtered].sort((a, b) => {
        let aVal = ''
        let bVal = ''

        switch (sortConfig.key) {
          case 'applicantName': {
            const ac = a.application.customer
            const bc = b.application.customer
            aVal = ac.type === 'CORPORATE' ? (ac.companyName || '') : `${ac.lastName || ''}${ac.firstName || ''}`
            bVal = bc.type === 'CORPORATE' ? (bc.companyName || '') : `${bc.lastName || ''}${bc.firstName || ''}`
            break
          }
          case 'companyName':
            aVal = a.application.customer.companyName || ''
            bVal = b.application.customer.companyName || ''
            break
          case 'phoneNumber':
            aVal = pendingChanges[a.id]?.msisdn !== undefined ? (pendingChanges[a.id].msisdn || '') : (a.msisdn || '')
            bVal = pendingChanges[b.id]?.msisdn !== undefined ? (pendingChanges[b.id].msisdn || '') : (b.msisdn || '')
            break
          case 'iccid':
            aVal = pendingChanges[a.id]?.simId !== undefined ? (pendingChanges[a.id].simId || '') : (a.simId || '')
            bVal = pendingChanges[b.id]?.simId !== undefined ? (pendingChanges[b.id].simId || '') : (b.simId || '')
            break
          case 'lineTag': {
            const aTag = pendingChanges[a.id]?.lineTagId !== undefined
              ? lineTags.find(t => t.id === pendingChanges[a.id].lineTagId)?.name || ''
              : a.lineTag?.name || ''
            const bTag = pendingChanges[b.id]?.lineTagId !== undefined
              ? lineTags.find(t => t.id === pendingChanges[b.id].lineTagId)?.name || ''
              : b.lineTag?.name || ''
            aVal = aTag
            bVal = bTag
            break
          }
          case 'lineReserveTag': {
            const aTag = pendingChanges[a.id]?.lineReserveTagId !== undefined
              ? lineReserveTags.find(t => t.id === pendingChanges[a.id].lineReserveTagId)?.name || ''
              : a.lineReserveTag?.name || ''
            const bTag = pendingChanges[b.id]?.lineReserveTagId !== undefined
              ? lineReserveTags.find(t => t.id === pendingChanges[b.id].lineReserveTagId)?.name || ''
              : b.lineReserveTag?.name || ''
            aVal = aTag
            bVal = bTag
            break
          }
          case 'shippedAt':
            aVal = (pendingChanges[a.id]?.shippedAt !== undefined ? pendingChanges[a.id].shippedAt : a.shippedAt) || ''
            bVal = (pendingChanges[b.id]?.shippedAt !== undefined ? pendingChanges[b.id].shippedAt : b.shippedAt) || ''
            break
          case 'returnedAt':
            aVal = (pendingChanges[a.id]?.returnedAt !== undefined ? pendingChanges[a.id].returnedAt : a.returnedAt) || ''
            bVal = (pendingChanges[b.id]?.returnedAt !== undefined ? pendingChanges[b.id].returnedAt : b.returnedAt) || ''
            break
          case 'status': {
            const aStatus = pendingChanges[a.id]?.status || a.status
            const bStatus = pendingChanges[b.id]?.status || b.status
            const aOrder = STATUS_SORT_ORDER[aStatus] || 99
            const bOrder = STATUS_SORT_ORDER[bStatus] || 99
            return sortConfig.direction === 'asc' ? aOrder - bOrder : bOrder - aOrder
          }
          default:
            return 0
        }

        if (!aVal && !bVal) return 0
        if (!aVal) return 1
        if (!bVal) return -1
        return sortConfig.direction === 'asc'
          ? aVal.localeCompare(bVal, 'ja')
          : bVal.localeCompare(aVal, 'ja')
      })
    }

    return filtered
  }, [lines, filterConfig, sortConfig, pendingChanges, lineTags, lineReserveTags])

  // --- ハンドラー ---

  const handleLineChange = (lineId: string, field: keyof PendingChange, value: string | number | null) => {
    setPendingChanges(prev => ({
      ...prev,
      [lineId]: { ...prev[lineId], [field]: value },
    }))
  }

  const handleSaveAll = async () => {
    const entries = Object.entries(pendingChanges)
    if (entries.length === 0) return

    setIsSaving(true)
    try {
      const results = await Promise.all(
        entries.map(([lineId, changes]) => {
          const body: Record<string, unknown> = {}
          if (changes.msisdn !== undefined) body.msisdn = changes.msisdn
          if (changes.simId !== undefined) body.simId = changes.simId
          if (changes.lineTagId !== undefined) body.lineTagId = changes.lineTagId
          if (changes.lineReserveTagId !== undefined) body.lineReserveTagId = changes.lineReserveTagId
          if (changes.shippedAt !== undefined) body.shippedAt = changes.shippedAt || null
          if (changes.returnedAt !== undefined) body.returnedAt = changes.returnedAt || null
          if (changes.status !== undefined) body.status = changes.status

          return fetch(`/api/admin/lines/${lineId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
        })
      )

      const failCount = results.filter(r => !r.ok).length
      if (failCount > 0) {
        alert(`${failCount}件の更新に失敗しました`)
      } else {
        alert(`${entries.length}件の回線を更新しました`)
      }

      setPendingChanges({})
      await fetchLines()
    } catch (error) {
      console.error('保存エラー:', error)
      alert('保存中にエラーが発生しました')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancelAll = () => {
    setPendingChanges({})
  }

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  const handleCheckboxChange = (lineId: string) => {
    setSelectedLines(prev => {
      const next = new Set(prev)
      if (next.has(lineId)) next.delete(lineId)
      else next.add(lineId)
      return next
    })
  }

  const handleSelectAll = () => {
    if (selectedLines.size === filteredAndSortedLines.length) {
      setSelectedLines(new Set())
    } else {
      setSelectedLines(new Set(filteredAndSortedLines.map(l => l.id)))
    }
  }

  const handleBulkApply = () => {
    selectedLines.forEach(lineId => {
      if (bulkSettings.lineTagId !== undefined && bulkSettings.lineTagId !== '') {
        handleLineChange(lineId, 'lineTagId', bulkSettings.lineTagId === '__clear__' ? null : Number(bulkSettings.lineTagId))
      }
      if (bulkSettings.lineReserveTagId !== undefined && bulkSettings.lineReserveTagId !== '') {
        handleLineChange(lineId, 'lineReserveTagId', bulkSettings.lineReserveTagId === '__clear__' ? null : Number(bulkSettings.lineReserveTagId))
      }
      if (bulkSettings.shippedAt) {
        handleLineChange(lineId, 'shippedAt', bulkSettings.shippedAt)
      }
      if (bulkSettings.returnedAt) {
        handleLineChange(lineId, 'returnedAt', bulkSettings.returnedAt)
      }
      if (bulkSettings.status) {
        handleLineChange(lineId, 'status', bulkSettings.status)
      }
    })
    alert(`${selectedLines.size}件の回線に設定を適用しました`)
    setShowBulkModal(false)
    setBulkSettings({})
  }

  const updateFilter = <K extends keyof FilterConfig>(key: K, value: FilterConfig[K]) => {
    setFilterConfig(prev => ({ ...prev, [key]: value }))
  }

  const toggleFilterCheckbox = (key: 'lineTagIds' | 'lineReserveTagIds' | 'lineStatuses', value: string) => {
    setFilterConfig(prev => {
      const arr = prev[key]
      if (arr.includes(value)) {
        return { ...prev, [key]: arr.filter(v => v !== value) }
      } else {
        return { ...prev, [key]: [...arr, value] }
      }
    })
  }

  const hasPendingChanges = Object.keys(pendingChanges).length > 0

  const getDisplayValue = (line: Line, field: keyof PendingChange): string => {
    if (pendingChanges[line.id]?.[field] !== undefined) {
      const val = pendingChanges[line.id][field]
      return val == null ? '' : String(val)
    }
    switch (field) {
      case 'msisdn': return line.msisdn || ''
      case 'simId': return line.simId || ''
      case 'lineTagId': return line.lineTag?.id != null ? String(line.lineTag.id) : ''
      case 'lineReserveTagId': return line.lineReserveTag?.id != null ? String(line.lineReserveTag.id) : ''
      case 'shippedAt': return line.shippedAt ? line.shippedAt.slice(0, 10) : ''
      case 'returnedAt': return line.returnedAt ? line.returnedAt.slice(0, 10) : ''
      case 'status': return line.status
      default: return ''
    }
  }

  const getApplicantName = (line: Line) => {
    const c = line.application.customer
    return c.type === 'CORPORATE'
      ? c.companyName || ''
      : `${c.lastName || ''} ${c.firstName || ''}`
  }

  const getCompanyName = (line: Line) => {
    return line.application.customer.companyName || '-'
  }

  const SortHeader = ({ label, sortKey }: { label: string; sortKey: string }) => (
    <th
      className="px-2 py-2 text-left text-xs font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 select-none whitespace-nowrap"
      onClick={() => handleSort(sortKey)}
    >
      {label} {sortConfig.key === sortKey && (sortConfig.direction === 'asc' ? '↑' : '↓')}
    </th>
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto bg-gray-100">
      <div className="px-6 py-4 bg-white border-b flex items-center justify-between">
        <h1 className="text-xl font-bold">総合回線管理</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">
            表示: {filteredAndSortedLines.length}/{lines.length}件
          </span>
          <button
            onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
            className={`px-3 py-1.5 text-sm rounded border ${
              hasActiveFilters
                ? 'bg-blue-50 border-blue-300 text-blue-700'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            フィルター
          </button>
          {hasActiveFilters && (
            <button
              onClick={() => setFilterConfig(INITIAL_FILTER)}
              className="px-3 py-1.5 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              クリア
            </button>
          )}
        </div>
      </div>

      {isFilterPanelOpen && (
        <div className="px-6 py-4 bg-white border-b space-y-4">
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">申込者名</label>
              <input type="text" className="w-full px-2 py-1.5 border rounded text-sm" value={filterConfig.applicantName} onChange={e => updateFilter('applicantName', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">会社名</label>
              <input type="text" className="w-full px-2 py-1.5 border rounded text-sm" value={filterConfig.companyName} onChange={e => updateFilter('companyName', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">電話番号</label>
              <input type="text" className="w-full px-2 py-1.5 border rounded text-sm" value={filterConfig.phoneNumber} onChange={e => updateFilter('phoneNumber', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">ICCID</label>
              <input type="text" className="w-full px-2 py-1.5 border rounded text-sm" value={filterConfig.iccid} onChange={e => updateFilter('iccid', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">SIMの場所</label>
              <div className="border rounded max-h-32 overflow-y-auto p-2 space-y-1">
                <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={filterConfig.lineTagIds.includes('__empty__')} onChange={() => toggleFilterCheckbox('lineTagIds', '__empty__')} />（空）</label>
                {lineTags.map(tag => (<label key={tag.id} className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={filterConfig.lineTagIds.includes(String(tag.id))} onChange={() => toggleFilterCheckbox('lineTagIds', String(tag.id))} />{tag.name}</label>))}
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">予備タグ</label>
              <div className="border rounded max-h-32 overflow-y-auto p-2 space-y-1">
                <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={filterConfig.lineReserveTagIds.includes('__empty__')} onChange={() => toggleFilterCheckbox('lineReserveTagIds', '__empty__')} />（空）</label>
                {lineReserveTags.map(tag => (<label key={tag.id} className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={filterConfig.lineReserveTagIds.includes(String(tag.id))} onChange={() => toggleFilterCheckbox('lineReserveTagIds', String(tag.id))} />{tag.name}</label>))}
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">ステータス</label>
              <div className="border rounded max-h-32 overflow-y-auto p-2 space-y-1">
                {LINE_STATUS_OPTIONS.map(opt => (<label key={opt.value} className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={filterConfig.lineStatuses.includes(opt.value)} onChange={() => toggleFilterCheckbox('lineStatuses', opt.value)} />{opt.label}</label>))}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">発送日</label>
              <div className="flex items-center gap-2">
                <input type="date" className="px-2 py-1.5 border rounded text-sm" value={filterConfig.shippedAtFrom} onChange={e => updateFilter('shippedAtFrom', e.target.value)} />
                <span className="text-gray-400">〜</span>
                <input type="date" className="px-2 py-1.5 border rounded text-sm" value={filterConfig.shippedAtTo} onChange={e => updateFilter('shippedAtTo', e.target.value)} />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">返却日</label>
              <div className="flex items-center gap-2">
                <input type="date" className="px-2 py-1.5 border rounded text-sm" value={filterConfig.returnedAtFrom} onChange={e => updateFilter('returnedAtFrom', e.target.value)} />
                <span className="text-gray-400">〜</span>
                <input type="date" className="px-2 py-1.5 border rounded text-sm" value={filterConfig.returnedAtTo} onChange={e => updateFilter('returnedAtTo', e.target.value)} />
              </div>
            </div>
          </div>
        </div>
      )}

      {(hasPendingChanges || selectedLines.size > 0) && (
        <div className="sticky top-0 z-10 px-6 py-3 bg-yellow-100 border-b flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm">
            {hasPendingChanges && (<span className="text-yellow-800 font-medium">{Object.keys(pendingChanges).length}件の変更があります</span>)}
            {selectedLines.size > 0 && (<span className="text-blue-800 font-medium">{selectedLines.size}件の回線を選択中</span>)}
          </div>
          <div className="flex items-center gap-2">
            {selectedLines.size > 0 && (
              <button onClick={() => { setBulkSettings({}); setShowBulkModal(true) }} className="px-3 py-1.5 text-sm rounded bg-green-600 text-white hover:bg-green-700">選択した回線を一括設定</button>
            )}
            {hasPendingChanges && (
              <>
                <button onClick={handleCancelAll} className="px-3 py-1.5 text-sm rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50">キャンセル</button>
                <button onClick={handleSaveAll} disabled={isSaving} className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">{isSaving ? '保存中...' : '保存'}</button>
              </>
            )}
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="sticky top-0 bg-gray-50 z-[5]">
            <tr className="border-b border-gray-300">
              <th className="px-2 py-2 text-center w-8"><input type="checkbox" checked={filteredAndSortedLines.length > 0 && selectedLines.size === filteredAndSortedLines.length} onChange={handleSelectAll} /></th>
              <SortHeader label="申込者名" sortKey="applicantName" />
              <SortHeader label="会社名" sortKey="companyName" />
              <SortHeader label="電話番号" sortKey="phoneNumber" />
              <SortHeader label="ICCID" sortKey="iccid" />
              <SortHeader label="SIMの場所" sortKey="lineTag" />
              <SortHeader label="予備タグ" sortKey="lineReserveTag" />
              <SortHeader label="発送日" sortKey="shippedAt" />
              <SortHeader label="返却日" sortKey="returnedAt" />
              <SortHeader label="ステータス" sortKey="status" />
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedLines.length === 0 ? (
              <tr><td colSpan={10} className="px-3 py-8 text-center text-gray-500">回線が見つかりません</td></tr>
            ) : (
              filteredAndSortedLines.map((line) => {
                const hasChange = !!pendingChanges[line.id]
                const isSelected = selectedLines.has(line.id)
                return (
                  <tr key={line.id} className={`border-b border-gray-200 ${hasChange ? 'bg-yellow-50' : isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                    <td className="px-2 py-1.5 text-center"><input type="checkbox" checked={isSelected} onChange={() => handleCheckboxChange(line.id)} /></td>
                    <td className="px-2 py-1.5 text-sm text-gray-900 whitespace-nowrap"><Link href={`/admin/applications/${line.application.id}`} className="text-blue-600 hover:text-blue-800">{getApplicantName(line)}</Link></td>
                    <td className="px-2 py-1.5 text-sm text-gray-900 whitespace-nowrap">{getCompanyName(line)}</td>
                    <td className="px-2 py-1.5"><input type="text" placeholder="電話番号" className="w-full px-1.5 py-1 border rounded text-sm min-w-[110px]" style={{ color: '#111827', backgroundColor: '#fff' }} value={getDisplayValue(line, 'msisdn')} onChange={e => handleLineChange(line.id, 'msisdn', e.target.value || null)} /></td>
                    <td className="px-2 py-1.5"><input type="text" placeholder="ICCID" className="w-full px-1.5 py-1 border rounded text-sm min-w-[160px]" style={{ color: '#111827', backgroundColor: '#fff' }} value={getDisplayValue(line, 'simId')} onChange={e => handleLineChange(line.id, 'simId', e.target.value || null)} /></td>
                    <td className="px-2 py-1.5"><select className="w-full px-1.5 py-1 border rounded text-sm min-w-[130px]" style={{ color: '#111827', backgroundColor: '#fff' }} value={getDisplayValue(line, 'lineTagId')} onChange={e => handleLineChange(line.id, 'lineTagId', e.target.value ? Number(e.target.value) : null)}><option value="">選択してください</option>{lineTags.map(tag => (<option key={tag.id} value={tag.id}>{tag.name}</option>))}</select></td>
                    <td className="px-2 py-1.5"><select className="w-full px-1.5 py-1 border rounded text-sm min-w-[130px]" style={{ color: '#111827', backgroundColor: '#fff' }} value={getDisplayValue(line, 'lineReserveTagId')} onChange={e => handleLineChange(line.id, 'lineReserveTagId', e.target.value ? Number(e.target.value) : null)}><option value="">選択してください</option>{lineReserveTags.map(tag => (<option key={tag.id} value={tag.id}>{tag.name}</option>))}</select></td>
                    <td className="px-2 py-1.5"><input type="date" className="px-1.5 py-1 border rounded text-sm min-w-[130px]" style={{ color: '#111827', backgroundColor: '#fff', colorScheme: 'light' }} value={getDisplayValue(line, 'shippedAt')} onChange={e => handleLineChange(line.id, 'shippedAt', e.target.value || null)} /></td>
                    <td className="px-2 py-1.5"><input type="date" className="px-1.5 py-1 border rounded text-sm min-w-[130px]" style={{ color: '#111827', backgroundColor: '#fff', colorScheme: 'light' }} value={getDisplayValue(line, 'returnedAt')} onChange={e => handleLineChange(line.id, 'returnedAt', e.target.value || null)} /></td>
                    <td className="px-2 py-1.5"><select className="w-full px-1.5 py-1 border rounded text-sm min-w-[100px]" style={{ color: '#111827', backgroundColor: '#fff' }} value={getDisplayValue(line, 'status')} onChange={e => handleLineChange(line.id, 'status', e.target.value)}>{LINE_STATUS_OPTIONS.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}</select></td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {showBulkModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-[480px] max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b">
              <h2 className="text-lg font-bold">一括設定</h2>
              <p className="text-sm text-gray-500 mt-1">{selectedLines.size}件の回線に設定を適用します</p>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">SIMの場所</label><select className="w-full px-3 py-2 border rounded" value={bulkSettings.lineTagId || ''} onChange={e => setBulkSettings(prev => ({ ...prev, lineTagId: e.target.value }))}><option value="">変更しない</option><option value="__clear__">（空にする）</option>{lineTags.map(tag => (<option key={tag.id} value={tag.id}>{tag.name}</option>))}</select></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">予備タグ</label><select className="w-full px-3 py-2 border rounded" value={bulkSettings.lineReserveTagId || ''} onChange={e => setBulkSettings(prev => ({ ...prev, lineReserveTagId: e.target.value }))}><option value="">変更しない</option><option value="__clear__">（空にする）</option>{lineReserveTags.map(tag => (<option key={tag.id} value={tag.id}>{tag.name}</option>))}</select></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">発送日</label><input type="date" className="w-full px-3 py-2 border rounded" value={bulkSettings.shippedAt || ''} onChange={e => setBulkSettings(prev => ({ ...prev, shippedAt: e.target.value }))} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">返却日</label><input type="date" className="w-full px-3 py-2 border rounded" value={bulkSettings.returnedAt || ''} onChange={e => setBulkSettings(prev => ({ ...prev, returnedAt: e.target.value }))} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">ステータス</label><select className="w-full px-3 py-2 border rounded" value={bulkSettings.status || ''} onChange={e => setBulkSettings(prev => ({ ...prev, status: e.target.value }))}><option value="">変更しない</option>{LINE_STATUS_OPTIONS.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}</select></div>
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-2">
              <button onClick={() => { setShowBulkModal(false); setBulkSettings({}) }} className="px-4 py-2 text-sm rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50">キャンセル</button>
              <button onClick={handleBulkApply} className="px-4 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700">適用</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
