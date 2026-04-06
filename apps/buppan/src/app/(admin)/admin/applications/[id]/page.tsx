'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { CustomerInfoSection } from './components/customer-info-section'
import { StatusSection } from './components/status-section'
import { KycImagesSection } from './components/kyc-images-section'
import { CommentsSection } from './components/comments-section'
import { LinesTable } from './components/lines-table'

interface LineTagType {
  id: number
  code: string
  name: string
}

interface Application {
  id: string
  applicationNumber: string
  lineCount: number
  unitPrice: number
  totalAmount: number
  status: string
  kycStatus: string
  paymentStatus: string
  comment1?: string | null
  comment2?: string | null
  isArchived: boolean
  createdAt: string
  customer: {
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
  plan: { id: string; name: string }
  lines: {
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
  }[]
  kycImages?: { id: string; type: string; storagePath: string; signedUrl?: string | null }[]
  idCardFrontUrl?: string | null
  idCardBackUrl?: string | null
  registrationUrl?: string | null
  expirationDate?: string | null
}

export default function ApplicationDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [application, setApplication] = useState<Application | null>(null)
  const [loading, setLoading] = useState(true)
  const [lineTags, setLineTags] = useState<LineTagType[]>([])
  const [lineReserveTags, setLineReserveTags] = useState<LineTagType[]>([])

  useEffect(() => {
    fetchApplication()
    fetchTags()
  }, [id])

  const fetchApplication = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/admin/applications/${id}`)
      if (!response.ok) throw new Error('Failed to fetch application')
      const data = await response.json()
      setApplication(data)
    } catch (error) {
      console.error('申し込み詳細の取得エラー:', error)
      alert('申し込み詳細の取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const fetchTags = async () => {
    try {
      const response = await fetch('/api/admin/tags')
      if (response.ok) {
        const data = await response.json()
        setLineTags(data.lineTags || [])
        setLineReserveTags(data.lineReserveTags || [])
      }
    } catch (error) {
      console.error('タグの取得エラー:', error)
    }
  }

  const handleArchiveToggle = async () => {
    const newArchiveState = !application?.isArchived
    const confirmMessage = newArchiveState
      ? 'この申し込みをアーカイブしますか？\nアーカイブすると一覧から非表示になります。'
      : 'この申し込みを復元しますか？\n復元すると一覧に再表示されます。'

    if (!confirm(confirmMessage)) return

    try {
      const response = await fetch(`/api/admin/applications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isArchived: newArchiveState }),
      })

      if (response.ok) {
        alert(newArchiveState ? 'アーカイブしました' : '復元しました')
        if (newArchiveState) {
          router.push('/admin/applications')
        } else {
          fetchApplication()
        }
      } else {
        alert('処理に失敗しました')
      }
    } catch (error) {
      console.error('アーカイブ処理エラー:', error)
      alert('処理に失敗しました')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    )
  }

  if (!application) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">申し込み情報が見つかりません</div>
      </div>
    )
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link
            href={application.isArchived ? '/admin/applications/archived' : '/admin/applications'}
            className="text-blue-600 hover:text-blue-800 mb-2 inline-block"
          >
            &larr; {application.isArchived ? 'アーカイブ一覧に戻る' : '一覧に戻る'}
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">
            申し込み詳細
            {application.isArchived && (
              <span className="ml-3 text-sm font-medium px-2 py-1 bg-gray-200 text-gray-700 rounded">
                アーカイブ済み
              </span>
            )}
          </h1>
        </div>
        <button
          onClick={handleArchiveToggle}
          className={`px-4 py-2 rounded text-sm font-medium ${
            application.isArchived
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-gray-600 hover:bg-gray-700 text-white'
          }`}
        >
          {application.isArchived ? '復元する' : 'アーカイブする'}
        </button>
      </div>

      <CustomerInfoSection
        customer={application.customer}
        planName={application.plan.name}
        lineCount={application.lineCount}
        totalAmount={application.totalAmount}
      />

      <StatusSection
        applicationId={application.id}
        kycStatus={application.kycStatus ?? 'PENDING'}
        paymentStatus={application.paymentStatus ?? 'BEFORE_INVOICE'}
        onUpdate={fetchApplication}
      />

      <KycImagesSection
        kycImages={application.kycImages}
        idCardFrontUrl={application.idCardFrontUrl}
        idCardBackUrl={application.idCardBackUrl}
        registrationUrl={application.registrationUrl}
      />

      <CommentsSection
        applicationId={application.id}
        initialComment1={application.comment1 || ''}
        initialComment2={application.comment2 || ''}
        onUpdate={fetchApplication}
      />

      <LinesTable
        applicationId={application.id}
        lines={application.lines || []}
        lineTags={lineTags}
        lineReserveTags={lineReserveTags}
        onRefresh={fetchApplication}
      />
    </>
  )
}
