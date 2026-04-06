/**
 * User Service
 *
 * ユーザーに関するビジネスロジックを担当
 * Repository層を使ってデータアクセスし、ビジネスルールを適用
 */

import { UserRepository, UserFilters } from '../repositories/user.repository';
import { UserWithRelations, UserCreateInput, UserUpdateInput } from '@/entities';
import { logger } from '../shared/utils/logger';
import { ConflictError, ForbiddenError, NotFoundError } from '../shared/errors/custom-errors';
import bcrypt from 'bcryptjs';
import { AdminSession } from '../lib/auth/admin-session';

export type { AdminSession };

export class UserService {
  constructor(private userRepo: UserRepository) {}

  /**
   * ユーザー一覧を取得
   */
  async getUserList(
    filters: UserFilters,
    session: AdminSession
  ): Promise<UserWithRelations[]> {
    logger.info('ユーザー一覧取得開始', { filters, sessionRole: session.role });

    // ビジネスルール: ADMINは自分のサービスのCUSTOMERのみ閲覧可能
    const effectiveFilters = {
      ...filters,
      scopedServiceId: session.scopedServiceId,
    };

    const users = await this.userRepo.findMany(effectiveFilters);

    logger.info('ユーザー一覧取得完了', { count: users.length });

    return users;
  }

  /**
   * ユーザーを作成
   * ビジネスルール:
   * - ADMINはCUSTOMERのみ作成可能
   * - メールアドレス重複チェック
   * - パスワードハッシュ化は呼び出し側で実施
   */
  async createUser(
    input: UserCreateInput & { password: string },
    session: AdminSession
  ): Promise<UserWithRelations> {
    logger.info('ユーザー作成開始', { email: input.email, role: input.role });

    // ビジネスルール: ADMINはCUSTOMERのみ作成可能
    if (session.scopedServiceId && input.role !== 'CUSTOMER') {
      logger.warn('権限エラー: ADMINは管理者ユーザーを作成できません', {
        sessionRole: session.role,
        requestedRole: input.role,
      });
      throw new ForbiddenError('管理者ユーザーを作成する権限がありません');
    }

    // ビジネスルール: メールアドレス重複チェック
    const exists = await this.userRepo.existsByEmail(input.email);
    if (exists) {
      logger.warn('メールアドレス重複エラー', { email: input.email });
      throw new ConflictError('このメールアドレスは既に使用されています');
    }

    // ビジネスルール: ADMINが作成する場合はserviceIdを強制
    const createData = {
      ...input,
      serviceId: session.scopedServiceId || input.serviceId || null,
    };

    const user = await this.userRepo.create(createData);

    logger.info('ユーザー作成完了', { userId: user.id, email: user.email });

    return user;
  }

  /**
   * ユーザーIDからユーザーを取得（詳細版：customers含む）
   */
  async getUserDetail(id: string): Promise<UserWithRelations | null> {
    logger.info('ユーザー詳細取得', { userId: id });

    const user = await this.userRepo.findByIdWithDetails(id);

    if (!user) {
      logger.warn('ユーザーが見つかりません', { userId: id });
      return null;
    }

    logger.debug('ユーザー詳細取得完了', { userId: id });

    return user;
  }

  /**
   * ユーザーを更新
   * ビジネスルール:
   * - ADMINはロール変更・サービス変更不可
   * - メールアドレス重複チェック
   * - パスワード変更時はハッシュ化
   */
  async updateUser(
    id: string,
    updateData: UserUpdateInput & { password?: string },
    session: AdminSession
  ): Promise<UserWithRelations> {
    logger.info('ユーザー更新開始', { userId: id });

    // 既存ユーザーの確認
    const existingUser = await this.userRepo.findById(id);
    if (!existingUser) {
      throw new NotFoundError('User', id);
    }

    // ビジネスルール: ADMINはロール変更不可
    if (session.scopedServiceId) {
      if (updateData.role && updateData.role !== 'CUSTOMER') {
        throw new ForbiddenError('ロールを変更する権限がありません');
      }
      if (
        updateData.serviceId !== undefined &&
        updateData.serviceId !== session.scopedServiceId
      ) {
        throw new ForbiddenError('サービスを変更する権限がありません');
      }
    }

    // ビジネスルール: メールアドレスの重複チェック（自分以外）
    if (updateData.email && updateData.email !== existingUser.email) {
      const existing = await this.userRepo.findByEmail(updateData.email);
      if (existing && existing.id !== id) {
        throw new ConflictError('このメールアドレスは既に使用されています');
      }
    }

    // ビジネスルール: パスワードが変更される場合はハッシュ化
    const finalUpdateData: Record<string, unknown> = { ...updateData };
    if (updateData.password) {
      finalUpdateData.password = await bcrypt.hash(updateData.password, 10);
    }

    const user = await this.userRepo.update(id, finalUpdateData);

    logger.info('ユーザー更新完了', { userId: id });

    return user;
  }

  /**
   * ユーザーを削除
   * ビジネスルール:
   * - 関連顧客がある場合は論理削除（無効化）
   * - 関連顧客がない場合は物理削除
   */
  async deleteUser(id: string): Promise<{ deleted: boolean; message: string }> {
    logger.info('ユーザー削除開始', { userId: id });

    // ユーザーの存在確認と関連データチェック
    const user = await this.userRepo.findByIdWithDetails(id);

    if (!user) {
      throw new NotFoundError('User', id);
    }

    // 関連顧客がある場合は論理削除
    if (user._count && user._count.customers > 0) {
      logger.info('関連顧客が存在するため論理削除', {
        userId: id,
        customerCount: user._count.customers,
      });
      await this.userRepo.deactivate(id);
      return {
        deleted: false,
        message: 'ユーザーを無効化しました',
      };
    }

    // 物理削除
    await this.userRepo.delete(id);

    logger.info('ユーザー削除完了', { userId: id });
    return {
      deleted: true,
      message: 'ユーザーを削除しました',
    };
  }

  /**
   * メールアドレスからユーザーを取得
   */
  async getUserByEmail(email: string): Promise<UserWithRelations | null> {
    logger.info('ユーザー検索（メール）', { email });

    return await this.userRepo.findByEmail(email);
  }
}
