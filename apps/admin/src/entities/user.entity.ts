/**
 * User Domain Entity
 *
 * ユーザー（管理者・カスタマー）のドメインエンティティ定義
 */

// User Role Enum
export enum UserRole {
  CUSTOMER = 'CUSTOMER',
  EMPLOYEE = 'EMPLOYEE',
  ADMIN = 'ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN',
}

/**
 * 基本User Entity
 */
export interface UserEntity {
  id: string;
  email: string;
  name: string | null;
  password: string;
  role: UserRole;
  serviceId: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User with Relations (API response用)
 * パスワードは除外
 */
export interface UserWithRelations extends Omit<UserEntity, 'password'> {
  service?: {
    id: string;
    name: string;
    code: string;
  } | null;
  _count?: {
    customers: number;
  };
}

/**
 * User Create Input
 */
export interface UserCreateInput {
  email: string;
  name?: string | null;
  password: string;
  role: UserRole;
  serviceId?: string | null;
  isActive?: boolean;
}

/**
 * User Update Input
 */
export interface UserUpdateInput {
  email?: string;
  name?: string | null;
  password?: string;
  role?: UserRole;
  serviceId?: string | null;
  isActive?: boolean;
}
