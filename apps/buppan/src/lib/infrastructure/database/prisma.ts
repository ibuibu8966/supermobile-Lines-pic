import { PrismaClient } from '@prisma/client';
import { logger } from '../../shared/utils/logger';

// PrismaClientのグローバルインスタンスを宣言
declare global {
  var prisma: PrismaClient | undefined;
}

// 動的にデータベースURLを設定してPrismaClientを作成
const createPrismaClient = () => {
  const databaseUrl = process.env.DATABASE_URL;

  // 環境変数の存在確認
  if (!databaseUrl) {
    logger.error('DATABASE_URLが環境変数に設定されていません');
    throw new Error('DATABASE_URL environment variable is required');
  }

  if (process.env.NODE_ENV === 'development') {
    logger.info('Prisma Clientを初期化中');
  }

  return new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl
      }
    },
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']
  });
};

// 開発環境では、ホットリロード時に複数のPrismaClientインスタンスが作成されるのを防ぐ
export const prisma = global.prisma || createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

// 接続テスト関数
export const testDatabaseConnection = async () => {
  try {
    await prisma.$connect();
    logger.info('データベース接続成功');
    return true;
  } catch (error) {
    logger.logError('データベース接続失敗', error);
    return false;
  }
};

// アプリケーション終了時の接続クリーンアップ
export const disconnectPrisma = async () => {
  try {
    await prisma.$disconnect();
    logger.info('データベース接続を切断しました');
  } catch (error) {
    logger.logError('データベース接続の切断中にエラーが発生', error);
  }
};
