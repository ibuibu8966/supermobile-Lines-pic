'use client'

import { useState, useEffect } from 'react'

interface Tag {
  id: number
  name: string
  code: string
  displayOrder: number
}

export default function TagsPage() {
  const [lineTags, setLineTags] = useState<Tag[]>([])
  const [lineReserveTags, setLineReserveTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)

  const [isAddingLineTag, setIsAddingLineTag] = useState(false)
  const [isAddingReserveTag, setIsAddingReserveTag] = useState(false)
  const [newLineTagName, setNewLineTagName] = useState('')
  const [newReserveTagName, setNewReserveTagName] = useState('')

  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingType, setEditingType] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  useEffect(() => {
    fetchTags()
  }, [])

  const fetchTags = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/tags')
      if (res.ok) {
        const data = await res.json()
        setLineTags(data.lineTags || [])
        setLineReserveTags(data.lineReserveTags || [])
      }
    } catch (error) {
      console.error('タグ取得エラー:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddTag = async (type: 'line_tag' | 'line_reserve_tag', name: string) => {
    if (!name.trim()) {
      alert('タグ名を入力してください')
      return
    }
    try {
      const res = await fetch('/api/admin/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, name: name.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'タグの作成に失敗しました')
        return
      }
      if (type === 'line_tag') {
        setIsAddingLineTag(false)
        setNewLineTagName('')
      } else {
        setIsAddingReserveTag(false)
        setNewReserveTagName('')
      }
      await fetchTags()
    } catch (error) {
      console.error('タグ作成エラー:', error)
      alert('タグの作成に失敗しました')
    }
  }

  const handleUpdateTag = async () => {
    if (!editingName.trim() || editingId == null || !editingType) return
    try {
      const res = await fetch(`/api/admin/tags/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: editingType, name: editingName.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'タグの更新に失敗しました')
        return
      }
      setEditingId(null)
      setEditingType(null)
      setEditingName('')
      await fetchTags()
    } catch (error) {
      console.error('タグ更新エラー:', error)
      alert('タグの更新に失敗しました')
    }
  }

  const handleDeleteTag = async (id: number, type: 'line_tag' | 'line_reserve_tag') => {
    if (!confirm('このタグを削除しますか？')) return
    try {
      const res = await fetch(`/api/admin/tags/${id}?type=${type}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'タグの削除に失敗しました')
        return
      }
      await fetchTags()
    } catch (error) {
      console.error('タグ削除エラー:', error)
      alert('タグの削除に失敗しました')
    }
  }

  const startEditing = (tag: Tag, type: string) => {
    setEditingId(tag.id)
    setEditingType(type)
    setEditingName(tag.name)
  }

  const cancelEditing = () => {
    setEditingId(null)
    setEditingType(null)
    setEditingName('')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    )
  }

  const TagSection = ({
    title,
    tags,
    type,
    isAdding,
    setIsAdding,
    newName,
    setNewName,
  }: {
    title: string
    tags: Tag[]
    type: 'line_tag' | 'line_reserve_tag'
    isAdding: boolean
    setIsAdding: (v: boolean) => void
    newName: string
    setNewName: (v: string) => void
  }) => (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900">{title}</h2>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="px-4 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            + 追加
          </button>
        )}
      </div>

      {isAdding && (
        <div className="flex items-center gap-2 mb-4 p-3 bg-gray-50 rounded border">
          <input
            type="text"
            className="flex-1 px-3 py-1.5 border rounded text-sm text-gray-900"
            placeholder="タグ名を入力"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleAddTag(type, newName)
              if (e.key === 'Escape') { setIsAdding(false); setNewName('') }
            }}
            autoFocus
          />
          <button
            onClick={() => handleAddTag(type, newName)}
            className="px-3 py-1.5 text-sm rounded bg-green-600 text-white hover:bg-green-700"
          >
            保存
          </button>
          <button
            onClick={() => { setIsAdding(false); setNewName('') }}
            className="px-3 py-1.5 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-100"
          >
            キャンセル
          </button>
        </div>
      )}

      {tags.length === 0 ? (
        <p className="text-sm text-gray-500 py-4">タグがありません</p>
      ) : (
        <div className="space-y-2">
          {tags.map(tag => (
            <div
              key={tag.id}
              className="flex items-center justify-between px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              {editingId === tag.id && editingType === type ? (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="text"
                    className="flex-1 px-2 py-1 border rounded text-sm text-gray-900"
                    value={editingName}
                    onChange={e => setEditingName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleUpdateTag()
                      if (e.key === 'Escape') cancelEditing()
                    }}
                    autoFocus
                  />
                  <button
                    onClick={handleUpdateTag}
                    className="px-2 py-1 text-xs rounded bg-green-600 text-white hover:bg-green-700"
                  >
                    保存
                  </button>
                  <button
                    onClick={cancelEditing}
                    className="px-2 py-1 text-xs rounded border border-gray-300 text-gray-700 hover:bg-gray-100"
                  >
                    キャンセル
                  </button>
                </div>
              ) : (
                <>
                  <span className="text-sm text-gray-800">{tag.name}</span>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => startEditing(tag, type)}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      編集
                    </button>
                    <button
                      onClick={() => handleDeleteTag(tag.id, type)}
                      className="text-sm text-red-600 hover:text-red-800"
                    >
                      削除
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <>
      <h2 className="text-2xl font-bold mb-6">タグ管理</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <TagSection
          title="SIMの場所タグ"
          tags={lineTags}
          type="line_tag"
          isAdding={isAddingLineTag}
          setIsAdding={setIsAddingLineTag}
          newName={newLineTagName}
          setNewName={setNewLineTagName}
        />
        <TagSection
          title="予備タグ"
          tags={lineReserveTags}
          type="line_reserve_tag"
          isAdding={isAddingReserveTag}
          setIsAdding={setIsAddingReserveTag}
          newName={newReserveTagName}
          setNewName={setNewReserveTagName}
        />
      </div>
    </>
  )
}
