/**
 * Service Service
 *
 * サービスに関するビジネスロジックを担当
 * Repository層を使ってデータアクセスし、ビジネスルールを適用
 */

import { ServiceRepository, ServiceFilters } from '../repositories/service.repository';
import { ServiceWithRelations, ServiceCreateInput, ServiceUpdateInput } from '@/entities';
import { logger } from '../shared/utils/logger';
import { ConflictError, NotFoundError } from '../shared/errors/custom-errors';

export class ServiceService {
  constructor(private serviceRepo: ServiceRepository) {}

  /**
   * サービス一覧を取得
   */
  async getServiceList(filters: ServiceFilters): Promise<ServiceWithRelations[]> {
    logger.info('サービス一覧取得開始', { filters });

    const services = await this.serviceRepo.findMany(filters);

    logger.info('サービス一覧取得完了', { count: services.length });

    return services;
  }

  /**
   * サービスを作成
   * ビジネスルール: コード重複チェック
   */
  async createService(input: ServiceCreateInput): Promise<ServiceWithRelations> {
    logger.info('サービス作成開始', { code: input.code, name: input.name });

    // ビジネスルール: コード重複チェック
    const exists = await this.serviceRepo.existsByCode(input.code);
    if (exists) {
      logger.warn('コード重複エラー', { code: input.code });
      throw new ConflictError('このコードは既に使用されています');
    }

    const service = await this.serviceRepo.create(input);

    logger.info('サービス作成完了', { serviceId: service.id, code: service.code });

    return service;
  }

  /**
   * サービスIDからサービスを取得（詳細版：プラン詳細含む）
   */
  async getServiceDetail(id: string): Promise<ServiceWithRelations | null> {
    logger.info('サービス詳細取得', { serviceId: id });

    const service = await this.serviceRepo.findByIdWithDetails(id);

    if (!service) {
      logger.warn('サービスが見つかりません', { serviceId: id });
      return null;
    }

    logger.debug('サービス詳細取得完了', { serviceId: id });

    return service;
  }

  /**
   * サービスを更新
   * ビジネスルール: コードの重複チェック（自分以外）
   */
  async updateService(
    id: string,
    updateData: ServiceUpdateInput
  ): Promise<ServiceWithRelations> {
    logger.info('サービス更新開始', { serviceId: id });

    // 存在確認
    const existing = await this.serviceRepo.findById(id);
    if (!existing) {
      throw new NotFoundError('Service', id);
    }

    // ビジネスルール: コードの重複チェック（自分以外）
    if (updateData.code) {
      const duplicate = await this.serviceRepo.findByCodeExcept(updateData.code, id);
      if (duplicate) {
        throw new ConflictError('このコードは既に使用されています');
      }
    }

    // 更新実行
    const updated = await this.serviceRepo.update(id, updateData);

    logger.info('サービス更新完了', { serviceId: id });

    return updated;
  }

  /**
   * サービスを削除
   * ビジネスルール:
   * - 関連データ（プラン/申込/ユーザー）がある場合は論理削除（無効化）
   * - 関連データがない場合は物理削除
   */
  async deleteService(id: string): Promise<{ deleted: boolean; message: string }> {
    logger.info('サービス削除開始', { serviceId: id });

    // サービスの存在確認と関連データチェック
    const service = await this.serviceRepo.findByIdWithDetails(id);

    if (!service) {
      throw new NotFoundError('Service', id);
    }

    // 関連データの合計を計算
    const count = service._count;
    const totalRelated = count
      ? (count.plans ?? 0) + (count.applications ?? 0) + (count.users ?? 0)
      : 0;

    // 関連データがある場合は論理削除
    if (totalRelated > 0) {
      logger.info('関連データが存在するため論理削除', {
        serviceId: id,
        plans: count?.plans ?? 0,
        applications: count?.applications ?? 0,
        users: count?.users ?? 0,
      });
      await this.serviceRepo.deactivate(id);
      return {
        deleted: false,
        message: 'サービスを無効化しました',
      };
    }

    // 物理削除
    await this.serviceRepo.delete(id);

    logger.info('サービス削除完了', { serviceId: id });
    return {
      deleted: true,
      message: 'サービスを削除しました',
    };
  }

  /**
   * コードからサービスを取得
   */
  async getServiceByCode(code: string): Promise<ServiceWithRelations | null> {
    logger.info('サービス検索（コード）', { code });

    return await this.serviceRepo.findByCode(code);
  }
}
