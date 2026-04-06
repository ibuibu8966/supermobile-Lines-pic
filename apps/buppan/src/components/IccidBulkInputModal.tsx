'use client'

import { useState, useRef, useEffect } from 'react'

interface Line {
  id: string
  simId?: string | null
}

interface IccidBulkInputModalProps {
  isOpen: boolean
  onClose: () => void
  lines: Line[]
  onSave: (assignments: { lineId: string; iccid: string; contractMonth?: string }[]) => void
}

export default function IccidBulkInputModal({
  isOpen,
  onClose,
  lines,
  onSave,
}: IccidBulkInputModalProps) {
  const [currentInput, setCurrentInput] = useState('')
  const [contractMonth, setContractMonth] = useState('')
  const [assignments, setAssignments] = useState<{ lineId: string; iccid: string; contractMonth?: string }[]>([])
  const [errorMessage, setErrorMessage] = useState('')
  const [autoEnterMode, setAutoEnterMode] = useState(true)
  const inputRef = useRef<HTMLInputElement>(null)

  const emptyLines = lines.filter(line => !line.simId)
  const totalLines = emptyLines.length
  const remainingLines = totalLines - assignments.length

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  useEffect(() => {
    if (currentInput === '') {
      setErrorMessage('')
    }
  }, [currentInput])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAssign()
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setCurrentInput(value)

    if (!autoEnterMode && value.length >= 19) {
      setTimeout(() => {
        handleAssign()
      }, 100)
    }
  }

  const handleAssign = () => {
    const iccid = currentInput.trim()

    if (!iccid) return

    if (assignments.length >= totalLines) {
      setErrorMessage('すべての回線にICCIDが割り当て済みです')
      return
    }

    if (assignments.some(a => a.iccid === iccid)) {
      setErrorMessage('このICCIDは既に入力されています')
      return
    }

    if (lines.some(line => line.simId === iccid)) {
      setErrorMessage('このICCIDは既に他の回線に登録されています')
      return
    }

    const nextEmptyLine = emptyLines[assignments.length]
    if (nextEmptyLine) {
      setAssignments([...assignments, {
        lineId: nextEmptyLine.id,
        iccid,
        contractMonth: contractMonth || undefined
      }])
      setCurrentInput('')
      setErrorMessage('')

      setTimeout(() => {
        inputRef.current?.focus()
      }, 0)
    }
  }

  const handleRemoveLast = () => {
    if (assignments.length > 0) {
      setAssignments(assignments.slice(0, -1))
      setErrorMessage('')
    }
  }

  const handleSave = () => {
    onSave(assignments)
    handleReset()
    onClose()
  }

  const handleCancel = () => {
    handleReset()
    onClose()
  }

  const handleReset = () => {
    setCurrentInput('')
    setContractMonth('')
    setAssignments([])
    setErrorMessage('')
    setAutoEnterMode(true)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl">
        <h2 className="text-xl font-bold mb-4 text-gray-900">ICCID連続入力</h2>

        <div className="mb-4 p-4 bg-gray-50 rounded border border-gray-200">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            バーコードリーダーのタイプ
          </label>
          <div className="flex gap-4">
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                checked={autoEnterMode}
                onChange={() => setAutoEnterMode(true)}
                className="mr-2 w-4 h-4"
              />
              <span className="text-sm text-gray-700">
                エンターキー自動送信あり
              </span>
            </label>
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                checked={!autoEnterMode}
                onChange={() => setAutoEnterMode(false)}
                className="mr-2 w-4 h-4"
              />
              <span className="text-sm text-gray-700">
                エンターキー自動送信なし
              </span>
            </label>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {autoEnterMode
              ? '読み取り後にエンターキーが自動的に送信されるタイプ'
              : '読み取り後に文字列のみが入力されるタイプ（19桁で自動割り当て）'}
          </p>
        </div>

        <div className="mb-4 p-4 bg-blue-50 rounded">
          <p className="text-sm text-gray-700">
            バーコードリーダーでICCIDを読み取ってください。
          </p>
          <p className="text-sm text-gray-700">
            読み取り後、自動的に次の回線に割り当てられます。
          </p>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            契約月（全回線に適用）
          </label>
          <input
            type="month"
            value={contractMonth}
            onChange={(e) => setContractMonth(e.target.value)}
            className="w-48 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
          />
          <p className="mt-1 text-xs text-gray-500">
            空欄の場合は契約月は設定されません
          </p>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            ICCID入力
          </label>
          <input
            ref={inputRef}
            type="text"
            value={currentInput}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg font-mono text-gray-900"
            placeholder="ICCIDを読み取ってください"
            disabled={remainingLines === 0}
          />
          {errorMessage && (
            <p className="mt-2 text-sm text-red-600">{errorMessage}</p>
          )}
        </div>

        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">
              進捗: {assignments.length} / {totalLines}回線
            </span>
            <span className="text-sm text-gray-600">
              残り {remainingLines}回線
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: totalLines > 0 ? `${(assignments.length / totalLines) * 100}%` : '0%' }}
            />
          </div>
        </div>

        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-medium text-gray-700">
              入力済みICCID
            </label>
            {assignments.length > 0 && (
              <button
                onClick={handleRemoveLast}
                className="text-sm text-red-600 hover:text-red-800"
              >
                最後の入力を削除
              </button>
            )}
          </div>
          <div className="border border-gray-300 rounded-lg p-3 h-48 overflow-y-auto bg-gray-50">
            {assignments.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">
                まだ入力されていません
              </p>
            ) : (
              <div className="space-y-1">
                {assignments.map((assignment, index) => (
                  <div
                    key={index}
                    className={`text-sm font-mono p-2 rounded ${
                      index === assignments.length - 1
                        ? 'bg-blue-100 text-blue-900 font-semibold'
                        : 'text-gray-700'
                    }`}
                  >
                    {index + 1}. {assignment.iccid}
                    {index === assignments.length - 1 && (
                      <span className="ml-2 text-xs">&larr; 最新</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end space-x-3">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            disabled={assignments.length === 0}
            className={`px-4 py-2 text-white rounded ${
              assignments.length === 0
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            完了して保存 ({assignments.length}件)
          </button>
        </div>
      </div>
    </div>
  )
}
