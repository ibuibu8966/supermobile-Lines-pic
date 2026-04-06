'use client'

import { useState } from 'react'

interface LineTagType {
  id: number
  code: string
  name: string
}

interface BulkSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  lineTags: LineTagType[]
  lineReserveTags: LineTagType[]
  onApply: (settings: BulkSettings) => void
}

export interface BulkSettings {
  lineTagId: string
  lineReserveTagId: string
  shippedAt: string
  returnedAt: string
  contractMonth: string
  status: string
}

const LINE_STATUS_LABELS: Record<string, string> = {
  NOT_ACTIVATED: '未開通',
  ACTIVATED: '開通済み',
  SHIPPED: '発送済み',
  RETURNED: '返却済み',
  CANCELLED: '解約',
}

const INITIAL_SETTINGS: BulkSettings = {
  lineTagId: '',
  lineReserveTagId: '',
  shippedAt: '',
  returnedAt: '',
  contractMonth: '',
  status: '',
}

export function BulkSettingsModal({ isOpen, onClose, lineTags, lineReserveTags, onApply }: BulkSettingsModalProps) {
  const [settings, setSettings] = useState<BulkSettings>(INITIAL_SETTINGS)

  if (!isOpen) return null

  const handleApply = () => {
    onApply(settings)
    setSettings(INITIAL_SETTINGS)
  }

  const handleClose = () => {
    setSettings(INITIAL_SETTINGS)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <h3 className="text-lg font-bold mb-4 text-gray-900">選択した回線を一括設定</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">SIMの場所</label>
            <select
              value={settings.lineTagId}
              onChange={(e) => setSettings({ ...settings, lineTagId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded text-gray-900"
            >
              <option value="">変更しない</option>
              {lineTags.map((tag) => (
                <option key={tag.id} value={tag.id}>{tag.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">予備タグ</label>
            <select
              value={settings.lineReserveTagId}
              onChange={(e) => setSettings({ ...settings, lineReserveTagId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded text-gray-900"
            >
              <option value="">変更しない</option>
              {lineReserveTags.map((tag) => (
                <option key={tag.id} value={tag.id}>{tag.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">発送日</label>
            <input
              type="date"
              value={settings.shippedAt}
              onChange={(e) => setSettings({ ...settings, shippedAt: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded text-gray-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">返却日</label>
            <input
              type="date"
              value={settings.returnedAt}
              onChange={(e) => setSettings({ ...settings, returnedAt: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded text-gray-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">契約月</label>
            <input
              type="month"
              value={settings.contractMonth}
              onChange={(e) => setSettings({ ...settings, contractMonth: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded text-gray-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ステータス</label>
            <select
              value={settings.status}
              onChange={(e) => setSettings({ ...settings, status: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded text-gray-900"
            >
              <option value="">変更しない</option>
              {Object.entries(LINE_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-6 flex gap-2 justify-end">
          <button
            onClick={handleClose}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            キャンセル
          </button>
          <button
            onClick={handleApply}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            適用
          </button>
        </div>
      </div>
    </div>
  )
}
