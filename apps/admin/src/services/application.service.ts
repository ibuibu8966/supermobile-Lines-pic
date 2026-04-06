/**
 * Application Service
 *
 * 申込に関するビジネスロジックを担当
 * Repository層を使ってデータアクセスし、ビジネスルールを適用
 */

import { ApplicationRepository, ApplicationFilters } from '../repositories/application.repository';
import { ApplicationWithRelations, ApplicationCreateInput, ApplicationUpdateInput } from '@/entities';
import { supabaseAdmin } from '../lib/supabase/client';
import { STORAGE_CONFIG } from '../lib/storage/constants';
import { supabaseStorage } from '../lib/storage/supabase-storage';
import { PaginationInfo, createPaginationInfo } from '../shared/utils/helpers';
import { logger } from '../shared/utils/logger';
import { NotFoundError, ValidationError } from '../shared/errors/custom-errors';

export interface PaginationParams {
  page: number;
  pageSize: number;
  skip: number;
}

export interface ApplicationListResult {
  applications: ApplicationWithRelations[];
  pagination: PaginationInfo;
}

export class ApplicationService {
  constructor(
    private applicationRepo: ApplicationRepository
  ) {}

  /**
   * 申込一覧を取得
   */
  async getApplicationList(
    filters: ApplicationFilters,
    pagination: PaginationParams,
    session: { scopedServiceId?: string | null }
  ): Promise<ApplicationListResult> {
    logger.info('申込一覧取得開始', { filters, pagination });

    // Repository経由でデータ取得
    const { applications, total } = await this.applicationRepo.findMany(
      filters,
      { skip: pagination.skip, take: pagination.pageSize },
      session.scopedServiceId
    );

    logger.debug('Repository取得完了', { count: applications.length, total });

    // 顧客ごとの申込順番・KYC情報をDB側のWINDOW関数で一括計算（N+1クエリ回避）
    const applicationIds = applications.map((a) => a.id);
    const customerIds = [...new Set(applications.map((a) => a.customerId))];
    const statsMap = await this.applicationRepo.findApplicationStats(applicationIds, customerIds);

    // 統計情報を計算
    const applicationsWithStats = applications.map((app: ApplicationWithRelations) => {
      const lines: { status: string }[] = (app.lines as { status: string }[]) || [];
      const statuses = lines.map((l) => l.status);
      const uniqueStatuses = [...new Set(statuses)];
      const lineStatus = lines.length > 0 && uniqueStatuses.length === 1 ? uniqueStatuses[0] : null;
      const appStats = statsMap.get(app.id);
      return {
        ...app,
        stats: {
          lineCount: lines.length,
          shippedCount: lines.filter((l) => l.status === 'SHIPPED' || l.status === 'ARRIVED' || l.status === 'ACTIVATED').length,
          notActivatedCount: lines.filter((l) => l.status === 'SHIPPED' || l.status === 'ARRIVED').length,
          returnedCount: lines.filter((l) => l.status === 'RETURNED').length,
          lineStatus,
        },
        applicationOrdinal: appStats?.ordinal ?? 1,
        latestExpiryDate: appStats?.latestExpiryDate ?? null,
        needsKycCheck: appStats?.needsKycCheck ?? true,
      };
    });

    // ページネーション情報生成
    const paginationInfo = createPaginationInfo(
      pagination.page,
      pagination.pageSize,
      total
    );

    logger.info('申込一覧取得完了', {
      resultCount: applicationsWithStats.length,
      totalPages: paginationInfo.totalPages,
    });

    return {
      applications: applicationsWithStats,
      pagination: paginationInfo,
    };
  }

  /**
   * 申込詳細を取得
   */
  async getApplicationById(id: string): Promise<ApplicationWithRelations | null> {
    logger.info('申込詳細取得', { id });

    const application = await this.applicationRepo.findById(id);

    if (!application) {
      logger.warn('申込が見つかりません', { id });
      return null;
    }

    logger.debug('申込詳細取得完了', { id });

    return application;
  }

  /**
   * 申込を作成
   */
  async createApplication(
    data: ApplicationCreateInput
  ): Promise<ApplicationWithRelations> {
    logger.info('申込作成開始', { data });

    const application = await this.applicationRepo.create(data);

    logger.info('申込作成完了', { id: application.id });

    return application;
  }

  /**
   * 申込を更新
   */
  async updateApplication(
    id: string,
    data: ApplicationUpdateInput
  ): Promise<ApplicationWithRelations> {
    logger.info('申込更新開始', { id, data });

    // 更新実行（存在確認はコントローラー側で実施済み）
    const updated = await this.applicationRepo.update(id, data);

    logger.info('申込更新完了', { id });

    return updated;
  }

  // ─── 紹介者 ───────────────────────────────────────────

  async addReferral(applicationId: string, referrerName: string, fee: number) {
    return await this.applicationRepo.addReferral(applicationId, referrerName, fee);
  }

  async deleteReferral(referralId: string) {
    return await this.applicationRepo.deleteReferral(referralId);
  }

  // ─── 追跡番号 ─────────────────────────────────────────

  async addTracking(applicationId: string, carrier: string, trackingNumber: string) {
    return await this.applicationRepo.addTracking(applicationId, carrier, trackingNumber);
  }

  async deleteTracking(trackingId: string) {
    return await this.applicationRepo.deleteTracking(trackingId);
  }

  // ─── ワークフロー画像 ─────────────────────────────────

  /**
   * ワークフロー画像のpublicURLを取得
   */
  async getWorkflowImageUrls(applicationId: string): Promise<{
    invoicePdf: string | null;
    invoiceEmail: string | null;
    payment: string | null;
    shipping: string | null;
  }> {
    const paths = await this.applicationRepo.findWorkflowImagePaths(applicationId);
    if (!paths) throw new NotFoundError('申し込み');

    const toUrl = (path: string | null): string | null => {
      if (!path) return null;
      const { data } = supabaseAdmin.storage
        .from(STORAGE_CONFIG.BUCKET_NAME)
        .getPublicUrl(path);
      return data.publicUrl;
    };

    return {
      invoicePdf: toUrl(paths.invoicePdfPath),
      invoiceEmail: toUrl(paths.invoiceEmailPath),
      payment: toUrl(paths.paymentImagePath),
      shipping: toUrl(paths.shippingImagePath),
    };
  }

  /**
   * ワークフロー画像をアップロードしてDBパスを更新
   */
  async uploadWorkflowImage(
    applicationId: string,
    imageType: string,
    file: File
  ): Promise<{ path: string; url: string }> {
    const fieldMap: Record<string, string> = {
      invoicePdf: 'invoicePdfPath',
      invoiceEmail: 'invoiceEmailPath',
      payment: 'paymentImagePath',
      shipping: 'shippingImagePath',
    };

    const dbField = fieldMap[imageType];
    if (!dbField) throw new ValidationError('無効な imageType です');

    // 既存パスを取得して古いファイルを削除
    const existing = await this.applicationRepo.findWorkflowImagePaths(applicationId);
    if (!existing) throw new NotFoundError('申し込み');

    const existingPath = (existing as Record<string, string | null>)[dbField];
    if (existingPath) {
      try { await supabaseStorage.deleteFile(existingPath); } catch { /* 削除失敗は無視 */ }
    }

    // アップロード
    const filePath = supabaseStorage.generateFilePath(applicationId, imageType, file.name);
    const buffer = Buffer.from(await file.arrayBuffer());
    const uploadResult = await supabaseStorage.uploadFile(filePath, buffer, file.type);

    if (!uploadResult.success || !uploadResult.url) {
      throw new Error(uploadResult.error || 'アップロード失敗');
    }

    // DBに保存
    await this.applicationRepo.updateWorkflowImagePath(applicationId, dbField, filePath);

    return { path: filePath, url: uploadResult.url };
  }
}
