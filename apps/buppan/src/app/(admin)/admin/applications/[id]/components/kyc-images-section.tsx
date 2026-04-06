'use client'

interface KycImage {
  id: string
  type: string
  storagePath: string
  signedUrl?: string | null
}

interface KycImagesSectionProps {
  kycImages?: KycImage[]
  idCardFrontUrl?: string | null
  idCardBackUrl?: string | null
  registrationUrl?: string | null
}

export function KycImagesSection({ kycImages, idCardFrontUrl, idCardBackUrl, registrationUrl }: KycImagesSectionProps) {
  // kycImages配列がある場合はそこからURL取得、なければ直接URLフィールドを使用
  const frontUrl = kycImages?.find(img => img.type === 'ID_FRONT')?.signedUrl || idCardFrontUrl
  const backUrl = kycImages?.find(img => img.type === 'ID_BACK')?.signedUrl || idCardBackUrl
  const regUrl = kycImages?.find(img => img.type === 'ADDRESS_PROOF')?.signedUrl || registrationUrl

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">アップロード画像</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">身分証（表）</label>
          {frontUrl ? (
            <a href={frontUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-900">表示</a>
          ) : (
            <span className="text-gray-400">-</span>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">身分証（裏）</label>
          {backUrl ? (
            <a href={backUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-900">表示</a>
          ) : (
            <span className="text-gray-400">-</span>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">謄本</label>
          {regUrl ? (
            <a href={regUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-900">表示</a>
          ) : (
            <span className="text-gray-400">-</span>
          )}
        </div>
      </div>
    </div>
  )
}
