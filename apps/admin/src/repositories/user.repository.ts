/**
 * User Repository
 *
 * ユーザーのデータアクセス層
 * Prismaとの直接的なやり取りを担当
 */

import { PrismaClient, Prisma, $Enums } from '@prisma/client';
import { UserWithRelations, UserCreateInput } from '@/entities';
import { logger } from '../shared/utils/logger';

export interface UserFilters {
  includeInactive?: boolean;
  role?: string;
  serviceId?: string;
  scopedServiceId?: string | null;
}

export class UserRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * ユーザー一覧を取得（フィルタリング対応）
   */
  async findMany(filters: UserFilters): Promise<UserWithRelations[]> {
    const where = this.buildWhereClause(filters);

    logger.debug('UserRepository.findMany', { where });

    const users = await this.prisma.user.findMany({
      where,
      include: {
        service: {
          select: { id: true, code: true, name: true },
        },
        customers: {
          select: {
            type: true,
            lastName: true,
            firstName: true,
            companyName: true,
          },
          take: 1,
        },
        _count: {
          select: {
            customers: true,
          },
        },
      },
      orderBy: [{ role: 'asc' }, { email: 'asc' }],
    });

    // パスワードを除外
    return users.map(({ password, ...rest }) => rest) as unknown as UserWithRelations[];
  }

  /**
   * メールアドレスからユーザーを取得
   */
  async findByEmail(email: string): Promise<UserWithRelations | null> {
    logger.debug('UserRepository.findByEmail', { email });

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        service: true,
      },
    });

    if (!user) return null;

    // パスワードを除外
    const { password, ...sanitizedUser } = user;
    return sanitizedUser as unknown as UserWithRelations;
  }

  /**
   * IDからユーザーを取得
   */
  async findById(id: string): Promise<UserWithRelations | null> {
    logger.debug('UserRepository.findById', { id });

    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        service: true,
      },
    });

    if (!user) return null;

    // パスワードを除外
    const { password, ...sanitizedUser } = user;
    return sanitizedUser as unknown as UserWithRelations;
  }

  /**
   * IDからユーザーを取得（詳細版：customers含む）
   */
  async findByIdWithDetails(id: string): Promise<UserWithRelations | null> {
    logger.debug('UserRepository.findByIdWithDetails', { id });

    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        service: true,
        customers: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: {
            customers: true,
          },
        },
      },
    });
    return user as unknown as UserWithRelations | null;
  }

  /**
   * ユーザーを作成
   */
  async create(data: UserCreateInput & { password: string }): Promise<UserWithRelations> {
    logger.debug('UserRepository.create', { email: data.email, role: data.role });

    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        name: data.name || null,
        password: data.password,
        role: data.role as $Enums.UserRole,
        serviceId: data.serviceId || null,
        isActive: data.isActive ?? true,
      },
      include: {
        service: true,
      },
    });

    // パスワードを除外
    const { password, ...sanitizedUser } = user;
    return sanitizedUser as unknown as UserWithRelations;
  }

  /**
   * ユーザーの存在確認（メールアドレス）
   */
  async existsByEmail(email: string): Promise<boolean> {
    const count = await this.prisma.user.count({
      where: { email },
    });
    return count > 0;
  }

  /**
   * ユーザーの存在確認（ID）
   */
  async exists(id: string): Promise<boolean> {
    const count = await this.prisma.user.count({
      where: { id },
    });
    return count > 0;
  }

  /**
   * ユーザーを更新
   */
  async update(id: string, data: Prisma.UserUpdateInput): Promise<UserWithRelations> {
    logger.debug('UserRepository.update', { id, data });

    const user = await this.prisma.user.update({
      where: { id },
      data,
      include: {
        service: true,
      },
    });
    return user as unknown as UserWithRelations;
  }

  /**
   * ユーザーを削除
   */
  async delete(id: string): Promise<void> {
    logger.debug('UserRepository.delete', { id });

    await this.prisma.user.delete({
      where: { id },
    });
  }

  /**
   * ユーザーを無効化（論理削除）
   */
  async deactivate(id: string): Promise<void> {
    logger.debug('UserRepository.deactivate', { id });

    await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * フィルタ条件からWhere句を構築
   */
  private buildWhereClause(filters: UserFilters): Prisma.UserWhereInput {
    const where: Prisma.UserWhereInput = {};

    // isActive filter
    if (!filters.includeInactive) {
      where.isActive = true;
    }

    // スコープ制限（ADMINは自分のサービスのCUSTOMERのみ）
    if (filters.scopedServiceId) {
      where.serviceId = filters.scopedServiceId;
      where.role = 'CUSTOMER' as $Enums.UserRole;
    } else {
      // Role filter
      if (filters.role) {
        where.role = filters.role as $Enums.UserRole;
      }

      // Service filter
      if (filters.serviceId) {
        where.serviceId = filters.serviceId;
      }
    }

    return where;
  }
}
