'use client'

import { useState } from 'react'

interface CommentsSectionProps {
  applicationId: string
  initialComment1: string
  initialComment2: string
  onUpdate: () => void
}

export function CommentsSection({ applicationId, initialComment1, initialComment2, onUpdate }: CommentsSectionProps) {
  const [comment1, setComment1] = useState(initialComment1)
  const [comment2, setComment2] = useState(initialComment2)
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    try {
      setIsSaving(true)
      const response = await fetch(`/api/admin/applications/${applicationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment1, comment2 }),
      })

      if (response.ok) {
        alert('コメントを保存しました')
        onUpdate()
      } else {
        alert('コメントの保存に失敗しました')
      }
    } catch (error) {
      console.error('コメント保存エラー:', error)
      alert('コメントの保存に失敗しました')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">コメント</h2>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">コメント1</label>
          <textarea
            value={comment1}
            onChange={(e) => setComment1(e.target.value)}
            rows={3}
            className="w-full px-1 py-0.5 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">コメント2</label>
          <textarea
            value={comment2}
            onChange={(e) => setComment2(e.target.value)}
            rows={3}
            className="w-full px-1 py-0.5 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
          />
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {isSaving ? '保存中...' : 'コメントを保存'}
        </button>
      </div>
    </div>
  )
}
