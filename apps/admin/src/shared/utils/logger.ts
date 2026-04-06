/**
 * ログ管理ユーティリティ
 * 構造化ログを提供し、本番環境での適切なログ管理を実現
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogContext {
  [key: string]: unknown;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV !== 'production';

  /**
   * ログを出力する共通メソッド
   */
  private log(level: LogLevel, message: string, context?: LogContext): void {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...context,
    };

    // 開発環境では見やすく整形して出力
    if (this.isDevelopment) {
      const colorMap = {
        info: '\x1b[36m',    // cyan
        warn: '\x1b[33m',    // yellow
        error: '\x1b[31m',   // red
        debug: '\x1b[90m',   // gray
      };
      const reset = '\x1b[0m';
      const color = colorMap[level];

      console.log(
        `${color}[${level.toUpperCase()}]${reset} ${timestamp} - ${message}`,
        context ? `\n${JSON.stringify(context, null, 2)}` : ''
      );
    } else {
      // 本番環境ではJSON形式で出力（ログ収集ツールに適した形式）
      console.log(JSON.stringify(logEntry));
    }
  }

  /**
   * 情報ログ
   */
  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  /**
   * 警告ログ
   */
  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  /**
   * エラーログ
   */
  error(message: string, context?: LogContext): void {
    this.log('error', message, context);
  }

  /**
   * デバッグログ（開発環境のみ）
   */
  debug(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      this.log('debug', message, context);
    }
  }

  /**
   * エラーオブジェクトから情報を抽出してログに記録
   */
  logError(message: string, error: unknown, context?: LogContext): void {
    const errorContext: LogContext = {
      ...context,
    };

    if (error instanceof Error) {
      errorContext.errorMessage = error.message;
      errorContext.errorStack = error.stack;
      errorContext.errorName = error.name;
    } else {
      errorContext.error = String(error);
    }

    this.error(message, errorContext);
  }
}

// シングルトンインスタンスをエクスポート
export const logger = new Logger();
