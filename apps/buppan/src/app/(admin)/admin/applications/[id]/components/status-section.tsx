'use client'

interface StatusSectionProps {
  applicationId: string
  kycStatus: string
  paymentStatus: string
  onUpdate: () => void
}

const KYC_OPTIONS = [
  { value: 'PENDING', label: '確認待ち', color: 'bg-gray-200 text-gray-800' },
  { value: 'DEFICIENT', label: '不備', color: 'bg-red-200 text-red-800' },
  { value: 'RESUBMIT', label: '再提出', color: 'bg-yellow-200 text-yellow-800' },
  { value: 'COMPLETED', label: '完了', color: 'bg-green-200 text-green-800' },
]

const PAYMENT_OPTIONS = [
  { value: 'BEFORE_INVOICE', label: '請求前', color: 'bg-gray-200 text-gray-800' },
  { value: 'INVOICED', label: '請求済み', color: 'bg-yellow-200 text-yellow-800' },
  { value: 'PAID', label: '入金済み', color: 'bg-green-200 text-green-800' },
]

function getOptionColor(options: typeof KYC_OPTIONS, value: string) {
  return options.find(o => o.value === value)?.color || 'bg-gray-200 text-gray-800'
}

export function StatusSection({ applicationId, kycStatus, paymentStatus, onUpdate }: StatusSectionProps) {
  const handleStatusChange = async (field: 'kycStatus' | 'paymentStatus', value: string) => {
    try {
      const response = await fetch(`/api/admin/applications/${applicationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      })

      if (response.ok) {
        onUpdate()
      } else {
        alert('ステータスの更新に失敗しました')
      }
    } catch (error) {
      console.error('ステータス更新エラー:', error)
      alert('ステータスの更新に失敗しました')
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">ステータス</h2>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">本人確認</label>
          <select
            value={kycStatus}
            onChange={(e) => handleStatusChange('kycStatus', e.target.value)}
            className={`px-3 py-2 text-sm font-semibold rounded border-0 ${getOptionColor(KYC_OPTIONS, kycStatus)} cursor-pointer`}
          >
            {KYC_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">決済確認</label>
          <select
            value={paymentStatus}
            onChange={(e) => handleStatusChange('paymentStatus', e.target.value)}
            className={`px-3 py-2 text-sm font-semibold rounded border-0 ${getOptionColor(PAYMENT_OPTIONS, paymentStatus)} cursor-pointer`}
          >
            {PAYMENT_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}
