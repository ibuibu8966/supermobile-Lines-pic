'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'

interface Customer {
  id: string
  type: string
  lastName: string
  firstName: string
  lastNameKana: string
  firstNameKana: string
  companyName?: string | null
  companyNameKana?: string | null
  email: string
  phone: string
}

interface Application {
  id: string
  applicationNumber: string
  lineCount: number
  totalAmount: number
  createdAt: string
  customer: Customer
}

export default function ArchivedApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [sortConfig, setSortConfig] = useState<{
    key: string | null
    direction: 'asc' | 'desc'
  }>({ key: null, direction: 'asc' })

  useEffect(() => {
    fetchApplications()
  }, [page])

  const fetchApplications = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        archived: 'true',
      })
      const response = await fetch(`/api/admin/applications?${params}`)
      if (!response.ok) throw new Error('Failed to fetch')
      const data = await response.json()
      setApplications(data.applications || data.data || [])
      setTotalPages(data.pagination.totalPages)
    } catch (error) {
      console.error('アーカイブ一覧の取得エラー:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }))
  }

  const sortedApplications = useMemo(() => {
    if (!sortConfig.key) return applications

    return [...applications].sort((a, b) => {
      let aValue = ''
      let bValue = ''

      switch (sortConfig.key) {
        case 'type':
          aValue = a.customer.type
          bValue = b.customer.type
          break
        case 'name':
          aValue = a.customer.type === 'CORPORATE'
            ? (a.customer.companyName || '')
            : `${a.customer.lastName}${a.customer.firstName}`
          bValue = b.customer.type === 'CORPORATE'
            ? (b.customer.companyName || '')
            : `${b.customer.lastName}${b.customer.firstName}`
          break
        case 'kana':
          aValue = a.customer.type === 'CORPORATE'
            ? (a.customer.companyNameKana || '')
            : `${a.customer.lastNameKana}${a.customer.firstNameKana}`
          bValue = b.customer.type === 'CORPORATE'
            ? (b.customer.companyNameKana || '')
            : `${b.customer.lastNameKana}${b.customer.firstNameKana}`
          break
        case 'phone':
          aValue = a.customer.phone
          bValue = b.customer.phone
          break
        case 'email':
          aValue = a.customer.email
          bValue = b.customer.email
          break
        case 'lineCount':
          return sortConfig.direction === 'asc'
            ? a.lineCount - b.lineCount
            : b.lineCount - a.lineCount
        case 'createdAt':
          aValue = a.createdAt
          bValue = b.createdAt
          break
        default:
          return 0
      }

      return sortConfig.direction === 'asc'
        ? aValue.localeCompare(bValue, 'ja')
        : bValue.localeCompare(aValue, 'ja')
    })
  }, [applications, sortConfig])

  const SortHeader = ({ label, sortKey }: { label: string; sortKey: string }) => (
    <th
      className="px-3 py-2 text-left text-xs font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 select-none whitespace-nowrap"
      onClick={() => handleSort(sortKey)}
    >
      {label} {sortConfig.key === sortKey && (sortConfig.direction === 'asc' ? '\u2191' : '\u2193')}
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
    <div className="h-full overflow-auto bg-gray-100 p-6">
      <div className="mx-auto">
        {/* ヘッダー */}
        <div className="mb-6">
          <Link
            href="/admin/applications"
            className="text-blue-600 hover:text-blue-800 mb-2 inline-block"
          >
            &larr; 申し込み一覧に戻る
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">アーカイブ済み申し込み</h1>
        </div>

        {/* テーブル */}
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-300">
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 whitespace-nowrap">
                  詳細
                </th>
                <SortHeader label="個人/法人" sortKey="type" />
                <SortHeader label="名前/会社名" sortKey="name" />
                <SortHeader label="カナ" sortKey="kana" />
                <SortHeader label="電話番号" sortKey="phone" />
                <SortHeader label="メール" sortKey="email" />
                <SortHeader label="回線数" sortKey="lineCount" />
                <SortHeader label="申込日" sortKey="createdAt" />
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 whitespace-nowrap">
                  詳細
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedApplications.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-gray-500">
                    アーカイブされた申し込みはありません
                  </td>
                </tr>
              ) : (
                sortedApplications.map((app) => (
                  <tr key={app.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-3 py-2 text-sm">
                      <Link
                        href={`/admin/applications/${app.id}`}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        詳細
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-900">
                      {app.customer.type === 'INDIVIDUAL' ? '個人' : '法人'}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-900">
                      {app.customer.type === 'CORPORATE'
                        ? app.customer.companyName
                        : `${app.customer.lastName} ${app.customer.firstName}`}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-900">
                      {app.customer.type === 'CORPORATE'
                        ? app.customer.companyNameKana
                        : `${app.customer.lastNameKana} ${app.customer.firstNameKana}`}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-900">
                      {app.customer.phone}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-900">
                      {app.customer.email}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-900 text-center">
                      {app.lineCount}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">
                      {new Date(app.createdAt).toLocaleDateString('ja-JP')}
                    </td>
                    <td className="px-3 py-2 text-sm">
                      <Link
                        href={`/admin/applications/${app.id}`}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        詳細
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ページネーション */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-4 mt-6">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 bg-white"
            >
              前へ
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 bg-white"
            >
              次へ
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
