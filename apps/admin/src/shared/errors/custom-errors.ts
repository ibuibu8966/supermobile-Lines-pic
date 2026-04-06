/**
 * カスタムエラークラス
 *
 * HTTPステータスコードと関連付けられたドメイン固有のエラー
 */

export class NotFoundError extends Error {
  public readonly statusCode = 404;

  constructor(resource: string, id?: string) {
    super(id ? `${resource}(ID: ${id})が見つかりません` : `${resource}が見つかりません`);
    this.name = 'NotFoundError';
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

export class ValidationError extends Error {
  public readonly statusCode = 400;

  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class UnauthorizedError extends Error {
  public readonly statusCode = 401;

  constructor(message: string = '認証が必要です') {
    super(message);
    this.name = 'UnauthorizedError';
    Object.setPrototypeOf(this, UnauthorizedError.prototype);
  }
}

export class ForbiddenError extends Error {
  public readonly statusCode = 403;

  constructor(message: string = 'アクセス権限がありません') {
    super(message);
    this.name = 'ForbiddenError';
    Object.setPrototypeOf(this, ForbiddenError.prototype);
  }
}

export class ConflictError extends Error {
  public readonly statusCode = 409;

  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}

export class BadRequestError extends Error {
  public readonly statusCode = 400;

  constructor(message: string) {
    super(message);
    this.name = 'BadRequestError';
    Object.setPrototypeOf(this, BadRequestError.prototype);
  }
}

/**
 * ビジネスルール違反エラー
 */
export class BusinessRuleError extends Error {
  public readonly statusCode = 422;

  constructor(message: string) {
    super(message);
    this.name = 'BusinessRuleError';
    Object.setPrototypeOf(this, BusinessRuleError.prototype);
  }
}

/**
 * データ整合性エラー
 */
export class DataIntegrityError extends Error {
  public readonly statusCode = 409;

  constructor(message: string) {
    super(message);
    this.name = 'DataIntegrityError';
    Object.setPrototypeOf(this, DataIntegrityError.prototype);
  }
}
