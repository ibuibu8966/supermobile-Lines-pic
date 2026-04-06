'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'

// URLがPDFかどうかを判定
const isPdfUrl = (url: string | null): boolean => {
  if (!url) return false
  const pathWithoutQuery = url.split('?')[0]
  return pathWithoutQuery.toLowerCase().endsWith('.pdf')
}

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
  postalCode: string
  prefecture: string
  city: string
  address: string
  building?: string | null
  companyPostalCode?: string | null
  companyPrefecture?: string | null
  companyCity?: string | null
  companyAddress?: string | null
  companyBuilding?: string | null
}

interface ApplicationLine {
  id: string
  lineNumber: number
  status: string
  shippedAt?: string | null
  returnedAt?: string | null
}

interface Application {
  id: string
  applicationNumber: string
  lineCount: number
  totalAmount: number
  status: string
  kycStatus: string
  paymentStatus: string
  expirationDate?: string | null
  comment1?: string | null
  comment2?: string | null
  isArchived: boolean
  createdAt: string
  customer: Customer
  plan: { id: string; name: string }
  lines: ApplicationLine[]
  idCardFrontUrl?: string | null
  idCardBackUrl?: string | null
  registrationUrl?: string | null
}

interface PendingChange {
  kycStatus?: string
  paymentStatus?: string
}

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [modalContent, setModalContent] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [pendingChanges, setPendingChanges] = useState<Record<string, PendingChange>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [imageModalOpen, setImageModalOpen] = useState(false)
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null)
  const [selectedImageType, setSelectedImageType] = useState<'front' | 'back' | 'registration'>('front')
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
        pageSize: '100',
        search,
        archived: 'false',
      })

      const response = await fetch(`/api/admin/applications?${params}`)
      const data = await response.json()
      setApplications(data.applications || data.data || [])
      setTotalPages(data.pagination?.totalPages || 1)
    } catch (error) {
      console.error('データ取得エラー:', error)
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

    const sorted = [...applications].sort((a, b) => {
      let aValue: string | number = ''
      let bValue: string | number = ''

      switch (sortConfig.key) {
        case 'applicantType':
          aValue = a.customer.type === 'INDIVIDUAL' ? '個人' : '法人'
          bValue = b.customer.type === 'INDIVIDUAL' ? '個人' : '法人'
          break
        case 'applicantName':
          aValue = a.customer.type === 'INDIVIDUAL'
            ? `${a.customer.lastName} ${a.customer.firstName}`
            : a.customer.companyName || ''
          bValue = b.customer.type === 'INDIVIDUAL'
            ? `${b.customer.lastName} ${b.customer.firstName}`
            : b.customer.companyName || ''
          break
        case 'kana':
          aValue = a.customer.type === 'INDIVIDUAL'
            ? `${a.customer.lastNameKana} ${a.customer.firstNameKana}`
            : a.customer.companyNameKana || ''
          bValue = b.customer.type === 'INDIVIDUAL'
            ? `${b.customer.lastNameKana} ${b.customer.firstNameKana}`
            : b.customer.companyNameKana || ''
          break
        case 'postalCode':
          aValue = a.customer.postalCode || ''
          bValue = b.customer.postalCode || ''
          break
        case 'address':
          aValue = `${a.customer.prefecture}${a.customer.city}${a.customer.address}`
          bValue = `${b.customer.prefecture}${b.customer.city}${b.customer.address}`
          break
        case 'companyAddress':
          aValue = `${a.customer.companyPrefecture || ''}${a.customer.companyCity || ''}${a.customer.companyAddress || ''}`
          bValue = `${b.customer.companyPrefecture || ''}${b.customer.companyCity || ''}${b.customer.companyAddress || ''}`
          break
        case 'phone':
          aValue = a.customer.phone || ''
          bValue = b.customer.phone || ''
          break
        case 'email':
          aValue = a.customer.email || ''
          bValue = b.customer.email || ''
          break
        case 'lineCount':
          aValue = a.lineCount || 0
          bValue = b.lineCount || 0
          break
        case 'shippedCount':
          aValue = a.lines?.filter(l => l.shippedAt).length || 0
          bValue = b.lines?.filter(l => l.shippedAt).length || 0
          break
        case 'notShippedCount':
          aValue = a.lineCount - (a.lines?.filter(l => l.shippedAt).length || 0)
          bValue = b.lineCount - (b.lines?.filter(l => l.shippedAt).length || 0)
          break
        case 'returnedCount':
          aValue = a.lines?.filter(l => l.returnedAt).length || 0
          bValue = b.lines?.filter(l => l.returnedAt).length || 0
          break
        case 'totalAmount':
          aValue = a.totalAmount || 0
          bValue = b.totalAmount || 0
          break
        case 'kycStatus': {
          const kycOrder: Record<string, number> = { PENDING: 1, DEFICIENT: 2, RESUBMIT: 3, COMPLETED: 4 }
          aValue = kycOrder[a.kycStatus] || 999
          bValue = kycOrder[b.kycStatus] || 999
          break
        }
        case 'paymentStatus': {
          const paymentOrder: Record<string, number> = { BEFORE_INVOICE: 1, INVOICED: 2, PAID: 3 }
          aValue = paymentOrder[a.paymentStatus] || 999
          bValue = paymentOrder[b.paymentStatus] || 999
          break
        }
        case 'expirationDate':
          aValue = a.expirationDate || ''
          bValue = b.expirationDate || ''
          break
        case 'createdAt':
          aValue = a.createdAt || ''
          bValue = b.createdAt || ''
          break
        case 'comment1':
          aValue = a.comment1 || ''
          bValue = b.comment1 || ''
          break
        case 'comment2':
          aValue = a.comment2 || ''
          bValue = b.comment2 || ''
          break
        default:
          return 0
      }

      if (!aValue && bValue) return 1
      if (aValue && !bValue) return -1
      if (!aValue && !bValue) return 0

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue
      }
      return sortConfig.direction === 'asc'
        ? String(aValue).localeCompare(String(bValue), 'ja')
        : String(bValue).localeCompare(String(aValue), 'ja')
    })

    return sorted
  }, [applications, sortConfig])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    fetchApplications()
  }

  const handleStatusChange = (applicationId: string, field: 'kycStatus' | 'paymentStatus', value: string) => {
    setPendingChanges(prev => ({
      ...prev,
      [applicationId]: {
        ...prev[applicationId],
        [field]: value
      }
    }))
  }

  const handleSaveAll = async () => {
    setIsSaving(true)
    try {
      const updates = Object.entries(pendingChanges).map(([id, changes]) => ({
        id,
        ...changes
      }))

      const response = await fetch('/api/admin/applications/batch-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      })

      if (response.ok) {
        setPendingChanges({})
        fetchApplications()
        alert('ステータスを一括更新しました')
      } else {
        alert('ステータスの更新に失敗しました')
      }
    } catch (error) {
      console.error('一括更新エラー:', error)
      alert('ステータスの更新に失敗しました')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancelAll = () => {
    setPendingChanges({})
  }

  const getApplicantName = (app: Application) => {
    if (app.customer.type === 'INDIVIDUAL') {
      return `${app.customer.lastName} ${app.customer.firstName}`
    }
    return app.customer.companyName || ''
  }

  const getApplicantNameKana = (app: Application) => {
    if (app.customer.type === 'INDIVIDUAL') {
      return `${app.customer.lastNameKana} ${app.customer.firstNameKana}`
    }
    return app.customer.companyNameKana || ''
  }

  const getFullAddress = (app: Application) => {
    return `${app.customer.prefecture}${app.customer.city}${app.customer.address}${app.customer.building || ''}`
  }

  const getCompanyFullAddress = (app: Application) => {
    if (app.customer.type !== 'CORPORATE') return '-'
    return `${app.customer.companyPrefecture || ''}${app.customer.companyCity || ''}${app.customer.companyAddress || ''}${app.customer.companyBuilding || ''}`
  }

  const getShippedCount = (app: Application) => {
    if (!app.lines) return 0
    return app.lines.filter(line => line.shippedAt).length
  }

  const getUnshippedCount = (app: Application) => {
    return app.lineCount - getShippedCount(app)
  }

  const getReturnedCount = (app: Application) => {
    if (!app.lines) return 0
    return app.lines.filter(line => line.returnedAt).length
  }

  const getKycBadge = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: 'bg-gray-200 text-gray-800',
      DEFICIENT: 'bg-red-200 text-red-800',
      RESUBMIT: 'bg-yellow-200 text-yellow-800',
      COMPLETED: 'bg-green-200 text-green-800',
    }
    return { color: colors[status] || 'bg-gray-200 text-gray-800' }
  }

  const getPaymentBadge = (status: string) => {
    const colors: Record<string, string> = {
      BEFORE_INVOICE: 'bg-gray-200 text-gray-800',
      INVOICED: 'bg-yellow-200 text-yellow-800',
      PAID: 'bg-green-200 text-green-800',
    }
    return { color: colors[status] || 'bg-gray-200 text-gray-800' }
  }

  const handleCellClick = (content: string) => {
    setModalContent(content)
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setModalContent(null)
  }

  const openImageModal = (app: Application, imageType: 'front' | 'back' | 'registration') => {
    setSelectedApplication(app)
    setSelectedImageType(imageType)
    setImageModalOpen(true)
  }

  const closeImageModal = () => {
    setImageModalOpen(false)
    setSelectedApplication(null)
  }

  const isExpired = (expirationDate: string | null | undefined) => {
    if (!expirationDate) return false
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const expDate = new Date(expirationDate)
    expDate.setHours(0, 0, 0, 0)
    return expDate < today
  }

  const hasPendingChanges = Object.keys(pendingChanges).length > 0

  const sortIndicator = (key: string) => {
    if (sortConfig.key !== key) return ''
    return sortConfig.direction === 'asc' ? ' ↑' : ' ↓'
  }

  return (
    <div className="flex flex-col h-full">
      {/* テーブル */}
      <div className="flex-1 overflow-auto bg-white">
        {loading ? (
          <div className="p-8 text-center text-gray-500">読み込み中...</div>
        ) : applications.length === 0 ? (
          <div className="p-8 text-center text-gray-500">データがありません</div>
        ) : (
          <>
            {hasPendingChanges && (
              <div className="sticky top-0 z-10 bg-yellow-100 border-b-2 border-yellow-300 px-4 py-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-yellow-800">
                  {Object.keys(pendingChanges).length}件の変更があります
                </span>
                <div className="flex gap-2">
                  <button onClick={handleCancelAll} disabled={isSaving} className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50 text-sm font-medium">
                    キャンセル
                  </button>
                  <button onClick={handleSaveAll} disabled={isSaving} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">
                    {isSaving ? '保存中...' : '保存'}
                  </button>
                </div>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300">
                <thead className="sticky top-0 z-20">
                  <tr className="bg-gray-100">
                    <th className="px-1 py-0.5 text-center text-[10px] font-bold text-gray-800 border border-gray-300">詳細</th>
                    <th colSpan={8} className="px-1 py-0.5 text-center text-[10px] font-bold text-gray-800 border border-gray-300">個人情報/法人情報</th>
                    <th colSpan={4} className="px-1 py-0.5 text-center text-[10px] font-bold text-gray-800 border border-gray-300">回線数</th>
                    <th className="px-1 py-0.5 text-center text-[10px] font-bold text-gray-800 border border-gray-300">画像</th>
                    <th className="px-1 py-0.5 text-center text-[10px] font-bold text-gray-800 border border-gray-300">有効期限</th>
                    <th colSpan={2} className="px-1 py-0.5 text-center text-[10px] font-bold text-gray-800 border border-gray-300">ステータス</th>
                    <th colSpan={2} className="px-1 py-0.5 text-center text-[10px] font-bold text-gray-800 border border-gray-300">コメント</th>
                    <th className="px-1 py-0.5 text-center text-[10px] font-bold text-gray-800 border border-gray-300">詳細</th>
                  </tr>
                  <tr className="bg-gray-50">
                    <th className="px-1 py-0.5 text-left text-[10px] font-semibold text-gray-700 border border-gray-300">詳細</th>
                    <th className="px-1 py-0.5 text-left text-[10px] font-semibold text-gray-700 border border-gray-300 cursor-pointer hover:bg-gray-200 select-none" onClick={() => handleSort('applicantType')}>個人/法人{sortIndicator('applicantType')}</th>
                    <th className="px-1 py-0.5 text-left text-[10px] font-semibold text-gray-700 border border-gray-300 cursor-pointer hover:bg-gray-200 select-none" onClick={() => handleSort('applicantName')}>名前/会社名{sortIndicator('applicantName')}</th>
                    <th className="px-1 py-0.5 text-left text-[10px] font-semibold text-gray-700 border border-gray-300 cursor-pointer hover:bg-gray-200 select-none" onClick={() => handleSort('kana')}>カナ{sortIndicator('kana')}</th>
                    <th className="px-1 py-0.5 text-left text-[10px] font-semibold text-gray-700 border border-gray-300 cursor-pointer hover:bg-gray-200 select-none" onClick={() => handleSort('postalCode')}>郵便番号{sortIndicator('postalCode')}</th>
                    <th className="px-1 py-0.5 text-left text-[10px] font-semibold text-gray-700 border border-gray-300 cursor-pointer hover:bg-gray-200 select-none" onClick={() => handleSort('address')}>住所{sortIndicator('address')}</th>
                    <th className="px-1 py-0.5 text-left text-[10px] font-semibold text-gray-700 border border-gray-300 cursor-pointer hover:bg-gray-200 select-none" onClick={() => handleSort('phone')}>電話番号{sortIndicator('phone')}</th>
                    <th className="px-1 py-0.5 text-left text-[10px] font-semibold text-gray-700 border border-gray-300 cursor-pointer hover:bg-gray-200 select-none" onClick={() => handleSort('email')}>メール{sortIndicator('email')}</th>
                    <th className="px-1 py-0.5 text-left text-[10px] font-semibold text-gray-700 border border-gray-300 cursor-pointer hover:bg-gray-200 select-none" onClick={() => handleSort('companyAddress')}>法人住所{sortIndicator('companyAddress')}</th>
                    <th className="px-1 py-0.5 text-left text-[10px] font-semibold text-gray-700 border border-gray-300 cursor-pointer hover:bg-gray-200 select-none" onClick={() => handleSort('lineCount')}>申込回線数{sortIndicator('lineCount')}</th>
                    <th className="px-1 py-0.5 text-left text-[10px] font-semibold text-gray-700 border border-gray-300 cursor-pointer hover:bg-gray-200 select-none" onClick={() => handleSort('shippedCount')}>発送済{sortIndicator('shippedCount')}</th>
                    <th className="px-1 py-0.5 text-left text-[10px] font-semibold text-gray-700 border border-gray-300 cursor-pointer hover:bg-gray-200 select-none" onClick={() => handleSort('notShippedCount')}>未発送{sortIndicator('notShippedCount')}</th>
                    <th className="px-1 py-0.5 text-left text-[10px] font-semibold text-gray-700 border border-gray-300 cursor-pointer hover:bg-gray-200 select-none" onClick={() => handleSort('returnedCount')}>返却済{sortIndicator('returnedCount')}</th>
                    <th className="px-1 py-0.5 text-left text-[10px] font-semibold text-gray-700 border border-gray-300">画像</th>
                    <th className="px-1 py-0.5 text-left text-[10px] font-semibold text-gray-700 border border-gray-300 cursor-pointer hover:bg-gray-200 select-none" onClick={() => handleSort('expirationDate')}>有効期限{sortIndicator('expirationDate')}</th>
                    <th className="px-1 py-0.5 text-left text-[10px] font-semibold text-gray-700 border border-gray-300 cursor-pointer hover:bg-gray-200 select-none" onClick={() => handleSort('kycStatus')}>本人確認{sortIndicator('kycStatus')}</th>
                    <th className="px-1 py-0.5 text-left text-[10px] font-semibold text-gray-700 border border-gray-300 cursor-pointer hover:bg-gray-200 select-none" onClick={() => handleSort('paymentStatus')}>決済確認{sortIndicator('paymentStatus')}</th>
                    <th className="px-1 py-0.5 text-left text-[10px] font-semibold text-gray-700 border border-gray-300 cursor-pointer hover:bg-gray-200 select-none" onClick={() => handleSort('comment1')}>コメント1{sortIndicator('comment1')}</th>
                    <th className="px-1 py-0.5 text-left text-[10px] font-semibold text-gray-700 border border-gray-300 cursor-pointer hover:bg-gray-200 select-none" onClick={() => handleSort('comment2')}>コメント2{sortIndicator('comment2')}</th>
                    <th className="px-1 py-0.5 text-left text-[10px] font-semibold text-gray-700 border border-gray-300">詳細</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {sortedApplications.map((app) => {
                    const expired = isExpired(app.expirationDate)
                    const hasChanges = !!pendingChanges[app.id]
                    const currentKycStatus = pendingChanges[app.id]?.kycStatus ?? app.kycStatus ?? 'PENDING'
                    const currentPaymentStatus = pendingChanges[app.id]?.paymentStatus ?? app.paymentStatus ?? 'BEFORE_INVOICE'

                    return (
                      <tr key={app.id} className={`hover:bg-blue-50 ${expired ? 'border-2 border-red-500' : ''} ${hasChanges ? 'bg-yellow-50' : ''}`}>
                        <td className="px-0.5 py-0.5 text-[10px] font-medium border border-gray-300">
                          <Link href={`/admin/applications/${app.id}`} className="text-blue-600 hover:text-blue-900">詳細</Link>
                        </td>
                        <td className="px-0.5 py-0.5 text-[10px] text-gray-900 border border-gray-300">
                          <div className="min-w-[5ch] truncate">{app.customer.type === 'INDIVIDUAL' ? '個人' : '法人'}</div>
                        </td>
                        <td className="px-0.5 py-0.5 text-[10px] text-gray-900 border border-gray-300 cursor-pointer hover:bg-gray-100" onClick={() => handleCellClick(getApplicantName(app))}>
                          <div className="min-w-[10ch] truncate" title={getApplicantName(app)}>{getApplicantName(app)}</div>
                        </td>
                        <td className="px-0.5 py-0.5 text-[10px] text-gray-900 border border-gray-300 cursor-pointer hover:bg-gray-100" onClick={() => handleCellClick(getApplicantNameKana(app))}>
                          <div className="min-w-[10ch] truncate" title={getApplicantNameKana(app)}>{getApplicantNameKana(app)}</div>
                        </td>
                        <td className="px-0.5 py-0.5 text-[10px] text-gray-900 border border-gray-300 cursor-pointer hover:bg-gray-100" onClick={() => handleCellClick(app.customer.postalCode)}>
                          <div className="min-w-[8ch] truncate">{app.customer.postalCode}</div>
                        </td>
                        <td className="px-0.5 py-0.5 text-[10px] text-gray-900 border border-gray-300 cursor-pointer hover:bg-gray-100" onClick={() => handleCellClick(getFullAddress(app))}>
                          <div className="min-w-[8ch] truncate" title={getFullAddress(app)}>{getFullAddress(app)}</div>
                        </td>
                        <td className="px-0.5 py-0.5 text-[10px] text-gray-900 border border-gray-300 cursor-pointer hover:bg-gray-100" onClick={() => handleCellClick(app.customer.phone)}>
                          <div className="min-w-[13ch] truncate">{app.customer.phone}</div>
                        </td>
                        <td className="px-0.5 py-0.5 text-[10px] text-gray-900 border border-gray-300 cursor-pointer hover:bg-gray-100" onClick={() => handleCellClick(app.customer.email)}>
                          <div className="min-w-[20ch] truncate" title={app.customer.email}>{app.customer.email}</div>
                        </td>
                        <td className="px-0.5 py-0.5 text-[10px] text-gray-900 border border-gray-300 cursor-pointer hover:bg-gray-100" onClick={() => handleCellClick(getCompanyFullAddress(app))}>
                          <div className="min-w-[8ch] truncate" title={getCompanyFullAddress(app)}>{getCompanyFullAddress(app)}</div>
                        </td>
                        <td className="px-0.5 py-0.5 text-[10px] text-gray-900 border border-gray-300">
                          <div className="min-w-[5ch] truncate">{app.lineCount}</div>
                        </td>
                        <td className="px-0.5 py-0.5 text-[10px] text-gray-900 border border-gray-300">
                          <div className="min-w-[4ch] truncate">{getShippedCount(app)}</div>
                        </td>
                        <td className="px-0.5 py-0.5 text-[10px] text-gray-900 border border-gray-300">
                          <div className="min-w-[4ch] truncate">{getUnshippedCount(app)}</div>
                        </td>
                        <td className="px-0.5 py-0.5 text-[10px] text-gray-900 border border-gray-300">
                          <div className="min-w-[4ch] truncate">{getReturnedCount(app)}</div>
                        </td>
                        <td className="px-0.5 py-0.5 text-[10px] border border-gray-300">
                          <div className="min-w-[12ch] flex gap-0.5">
                            {app.idCardFrontUrl ? (
                              <button onClick={() => openImageModal(app, 'front')} className="text-blue-600 hover:text-blue-900 cursor-pointer text-[9px]">表</button>
                            ) : (
                              <span className="text-gray-400 text-[9px]">-</span>
                            )}
                            <span className="text-gray-400">/</span>
                            {app.idCardBackUrl ? (
                              <button onClick={() => openImageModal(app, 'back')} className="text-blue-600 hover:text-blue-900 cursor-pointer text-[9px]">裏</button>
                            ) : (
                              <span className="text-gray-400 text-[9px]">-</span>
                            )}
                            <span className="text-gray-400">/</span>
                            {app.registrationUrl ? (
                              <button onClick={() => openImageModal(app, 'registration')} className="text-blue-600 hover:text-blue-900 cursor-pointer text-[9px]">謄</button>
                            ) : (
                              <span className="text-gray-400 text-[9px]">-</span>
                            )}
                          </div>
                        </td>
                        <td className="px-0.5 py-0.5 text-[10px] text-gray-900 border border-gray-300">
                          <div className="min-w-[10ch] truncate">
                            {app.expirationDate ? (
                              <span className={expired ? 'text-red-600 font-semibold' : ''}>
                                {new Date(app.expirationDate).toLocaleDateString('ja-JP')}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </div>
                        </td>
                        <td className="px-0.5 py-0.5 text-[10px] border border-gray-300">
                          <select
                            value={currentKycStatus}
                            onChange={(e) => handleStatusChange(app.id, 'kycStatus', e.target.value)}
                            className={`w-full px-1 py-0.5 text-[10px] font-semibold rounded border-0 ${getKycBadge(currentKycStatus).color} cursor-pointer`}
                            style={{ minWidth: '60px' }}
                          >
                            <option value="PENDING">確認待ち</option>
                            <option value="DEFICIENT">不備あり</option>
                            <option value="RESUBMIT">再提出</option>
                            <option value="COMPLETED">完了</option>
                          </select>
                        </td>
                        <td className="px-0.5 py-0.5 text-[10px] border border-gray-300">
                          <select
                            value={currentPaymentStatus}
                            onChange={(e) => handleStatusChange(app.id, 'paymentStatus', e.target.value)}
                            className={`w-full px-1 py-0.5 text-[10px] font-semibold rounded border-0 ${getPaymentBadge(currentPaymentStatus).color} cursor-pointer`}
                            style={{ minWidth: '60px' }}
                          >
                            <option value="BEFORE_INVOICE">請求書発行前</option>
                            <option value="INVOICED">発行済み</option>
                            <option value="PAID">入金済み</option>
                          </select>
                        </td>
                        <td className="px-0.5 py-0.5 text-[10px] text-gray-900 border border-gray-300 cursor-pointer hover:bg-gray-100" onClick={() => handleCellClick(app.comment1 || '-')}>
                          <div className="min-w-[10ch] max-w-[10ch] truncate" title={app.comment1 || '-'}>{app.comment1 || '-'}</div>
                        </td>
                        <td className="px-0.5 py-0.5 text-[10px] text-gray-900 border border-gray-300 cursor-pointer hover:bg-gray-100" onClick={() => handleCellClick(app.comment2 || '-')}>
                          <div className="min-w-[10ch] max-w-[10ch] truncate" title={app.comment2 || '-'}>{app.comment2 || '-'}</div>
                        </td>
                        <td className="px-0.5 py-0.5 text-[10px] font-medium border border-gray-300">
                          <Link href={`/admin/applications/${app.id}`} className="text-blue-600 hover:text-blue-900">詳細</Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ページネーション */}
      {totalPages > 1 && (
        <div className="bg-white px-6 py-4 border-t border-gray-200">
          <div className="flex justify-center gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-4 py-2 border border-gray-300 rounded-md disabled:opacity-50 text-sm">前へ</button>
            <span className="px-4 py-2 text-sm">{page} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-4 py-2 border border-gray-300 rounded-md disabled:opacity-50 text-sm">次へ</button>
          </div>
        </div>
      )}

      {/* テキストモーダル */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={closeModal}>
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">内容</h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
            </div>
            <div className="text-gray-800 whitespace-pre-wrap break-words max-h-96 overflow-y-auto">{modalContent}</div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  if (modalContent) {
                    navigator.clipboard.writeText(modalContent)
                    alert('コピーしました')
                  }
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                コピー
              </button>
              <button onClick={closeModal} className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300">閉じる</button>
            </div>
          </div>
        </div>
      )}

      {/* 画像モーダル */}
      {imageModalOpen && selectedApplication && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4" onClick={closeImageModal}>
          <div className="bg-white rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">申込情報と画像</h2>
              <button onClick={closeImageModal} className="text-gray-400 hover:text-gray-600 text-3xl font-bold">×</button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">申込情報</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="font-medium text-gray-600">申込タイプ:</span>
                    <p className="text-gray-900">{selectedApplication.customer.type === 'INDIVIDUAL' ? '個人' : '法人'}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">名前/会社名:</span>
                    <p className="text-gray-900">{getApplicantName(selectedApplication)}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">カナ:</span>
                    <p className="text-gray-900">{getApplicantNameKana(selectedApplication)}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">電話番号:</span>
                    <p className="text-gray-900">{selectedApplication.customer.phone}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="font-medium text-gray-600">メールアドレス:</span>
                    <p className="text-gray-900">{selectedApplication.customer.email}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">郵便番号:</span>
                    <p className="text-gray-900">{selectedApplication.customer.postalCode}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="font-medium text-gray-600">住所:</span>
                    <p className="text-gray-900">{getFullAddress(selectedApplication)}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">申込回線数:</span>
                    <p className="text-gray-900">{selectedApplication.lineCount}回線</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">プラン:</span>
                    <p className="text-gray-900">{selectedApplication.plan.name}</p>
                  </div>
                  {selectedApplication.expirationDate && (
                    <div className="col-span-2">
                      <span className="font-medium text-gray-600">身分証有効期限:</span>
                      <p className="text-gray-900">{new Date(selectedApplication.expirationDate).toLocaleDateString('ja-JP')}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">画像</h3>
                <div className="flex gap-2 border-b">
                  <button onClick={() => setSelectedImageType('front')} className={`px-4 py-2 font-medium ${selectedImageType === 'front' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}>身分証（表）</button>
                  <button onClick={() => setSelectedImageType('back')} className={`px-4 py-2 font-medium ${selectedImageType === 'back' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}>身分証（裏）</button>
                  {selectedApplication.customer.type === 'CORPORATE' && selectedApplication.registrationUrl && (
                    <button onClick={() => setSelectedImageType('registration')} className={`px-4 py-2 font-medium ${selectedImageType === 'registration' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}>謄本</button>
                  )}
                </div>
                <div className="bg-gray-100 rounded-lg p-4 flex items-center justify-center min-h-[400px]">
                  {selectedImageType === 'front' && selectedApplication.idCardFrontUrl && (
                    isPdfUrl(selectedApplication.idCardFrontUrl) ? (
                      <iframe src={selectedApplication.idCardFrontUrl} className="w-full h-[600px]" title="身分証（表）" />
                    ) : (
                      <img src={selectedApplication.idCardFrontUrl} alt="身分証（表）" className="max-w-full max-h-[600px] object-contain" />
                    )
                  )}
                  {selectedImageType === 'back' && selectedApplication.idCardBackUrl && (
                    isPdfUrl(selectedApplication.idCardBackUrl) ? (
                      <iframe src={selectedApplication.idCardBackUrl} className="w-full h-[600px]" title="身分証（裏）" />
                    ) : (
                      <img src={selectedApplication.idCardBackUrl} alt="身分証（裏）" className="max-w-full max-h-[600px] object-contain" />
                    )
                  )}
                  {selectedImageType === 'registration' && selectedApplication.registrationUrl && (
                    <iframe src={selectedApplication.registrationUrl} className="w-full h-[600px]" title="謄本" />
                  )}
                  {selectedImageType === 'front' && !selectedApplication.idCardFrontUrl && <p className="text-gray-400">画像がありません</p>}
                  {selectedImageType === 'back' && !selectedApplication.idCardBackUrl && <p className="text-gray-400">画像がありません</p>}
                  {selectedImageType === 'registration' && !selectedApplication.registrationUrl && <p className="text-gray-400">画像がありません</p>}
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 px-6 py-4 flex justify-end">
              <button onClick={closeImageModal} className="px-6 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 font-medium">閉じる</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
