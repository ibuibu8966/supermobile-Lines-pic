/**
 * Application Service
 *
 * 申込に関するビジネスロジックを担当
 * Repository層を使ってデータアクセスし、ビジネスルールを適用
 */

import { ApplicationRepository, ApplicationFilters } from '../repositories/application.repository';
import { ApplicationWithRelations } from '@/lib/entities';
import { CustomerApplicationInput, CustomerApplicationResult, CustomerInfo } from '@/lib/entities';
import { getServiceConfig } from '../config/service.config';
import { PaginationInfo, createPaginationInfo } from '../shared/utils/helpers';
import { logger } from '../shared/utils/logger';
import { ConflictError, ValidationError, NotFoundError } from '../shared/errors/custom-errors';
import type { PrismaClient } from '@prisma/client';

export interface PaginationParams {
  page: number;
  pageSize: number;
  skip: number;
}

export interface AdminSession {
  id: string;
  role: string;
  scopedServiceId?: string | null;
}

export interface ApplicationListResult {
  applications: ApplicationWithStats[];
  pagination: PaginationInfo;
}

export interface ApplicationDetailResult extends ApplicationWithRelations {
  stats: {
    lineCount: number;
    shippedCount: number;
    notActivatedCount: number;
    returnedCount: number;
  };
  latestExpiryDate: Date | null;
}

interface ApplicationWithStats extends ApplicationWithRelations {
  applicationOrdinal: number;
  stats: {
    lineCount: number;
    shippedCount: number;
    notActivatedCount: number;
    returnedCount: number;
  };
  latestExpiryDate: Date | null;
}

export class ApplicationService {
  constructor(private applicationRepo: ApplicationRepository, private prisma: any = (applicationRepo as any).prisma) {}

  /**
   * 申込一覧を取得（ビジネスロジック適用済み）
   */
  async getApplicationList(
    filters: ApplicationFilters,
    pagination: PaginationParams,
    session: AdminSession
  ): Promise<ApplicationListResult> {
    logger.info('申込一覧取得開始', {
      filters,
      pagination,
      sessionRole: session.role,
    });

    // 1. Repository経由でデータ取得
    const { applications, total } = await this.applicationRepo.findMany(
      filters,
      { skip: pagination.skip, take: pagination.pageSize },
      session.scopedServiceId
    );

    logger.debug('Repository取得完了', { count: applications.length, total });

    // 2. ビジネスロジック: 申込順序を計算
    const applicationsWithOrdinals = await this.addApplicationOrdinals(applications);

    // 3. ビジネスロジック: 統計情報を追加
    const applicationsWithStats = this.enrichWithStats(applicationsWithOrdinals);

    // 4. ページネーション情報生成
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
   * 申込IDから単一の申込を取得（統計情報付き）
   */
  async getApplicationById(id: string): Promise<ApplicationDetailResult | null> {
    logger.info('申込詳細取得', { applicationId: id });

    const application = await this.applicationRepo.findById(id);

    if (!application) {
      logger.warn('申込が見つかりません', { applicationId: id });
      return null;
    }

    // 回線統計を計算
    const shippedCount = application.lines?.filter(
      (l) => l.status === 'SHIPPED' || l.status === 'ACTIVATED'
    ).length || 0;

    const notActivatedCount = application.lines?.filter(
      (l) => l.status === 'NOT_ACTIVATED'
    ).length || 0;

    const returnedCount = application.lines?.filter(
      (l) => l.status === 'RETURNED'
    ).length || 0;

    // 最新の有効期限を取得
    const expiryDates = application.kycImages
      ?.filter((img) => img.expiryDate)
      .map((img) => img.expiryDate!) || [];

    const latestExpiryDate = expiryDates.length > 0
      ? expiryDates.reduce((a, b) => (a! > b! ? a : b))
      : null;

    logger.debug('申込詳細取得完了', {
      applicationId: id,
      applicationNumber: application.applicationNumber,
    });

    return {
      ...application,
      stats: {
        lineCount: application.lineCount,
        shippedCount,
        notActivatedCount,
        returnedCount,
      },
      latestExpiryDate,
    };
  }

  /**
   * 申込を更新
   */
  async updateApplication(
    id: string,
    updateData: {
      status?: string;
      kycStatus?: string;
      paymentStatus?: string;
      addressStatus?: string;
      comment1?: string | null;
      comment2?: string | null;
      note?: string | null;
      isArchived?: boolean;
    }
  ): Promise<ApplicationWithRelations> {
    logger.info('申込更新開始', { applicationId: id, updateData });

    // 存在確認
    const exists = await this.applicationRepo.exists(id);
    if (!exists) {
      logger.warn('申込が見つかりません', { applicationId: id });
      throw new Error('Application not found');
    }

    // 更新実行
    const updated = await this.applicationRepo.update(id, updateData as any);

    logger.info('申込更新完了', {
      applicationId: id,
      applicationNumber: updated.applicationNumber,
    });

    // 詳細情報を再取得して返す
    const fullApplication = await this.applicationRepo.findById(id);
    return fullApplication!;
  }

  /**
   * 顧客ごとの申込順序を計算
   * 同一顧客が複数回申し込んだ場合、時系列で何回目かを判定
   */
  private async addApplicationOrdinals(
    applications: ApplicationWithRelations[]
  ): Promise<ApplicationWithRelations[]> {
    if (applications.length === 0) return [];

    // 顧客IDを抽出
    const customerIds = [...new Set(applications.map((app) => app.customer!.id))];

    // 顧客ごとの全申込を取得（時系列順）
    const customerApplications = await this.applicationRepo.findByCustomerIds(customerIds);

    // 申込IDごとの順序番号をマップ化
    const ordinalMap = new Map<string, number>();
    const customerAppGroups = new Map<string, typeof customerApplications>();

    for (const ca of customerApplications) {
      if (!customerAppGroups.has(ca.customerId)) {
        customerAppGroups.set(ca.customerId, []);
      }
      customerAppGroups.get(ca.customerId)!.push(ca);
    }

    for (const [, apps] of customerAppGroups) {
      apps.forEach((app, index) => {
        ordinalMap.set(app.id, index + 1);
      });
    }

    // 申込に順序番号を付与
    return applications.map((app) => ({
      ...app,
      applicationOrdinal: ordinalMap.get(app.id) || 1,
    })) as ApplicationWithRelations[];
  }

  /**
   * 回線統計情報を追加
   * shipped/notActivated/returned の回線数を集計
   */
  private enrichWithStats(
    applications: ApplicationWithRelations[]
  ): ApplicationWithStats[] {
    return applications.map((app) => {
      // 回線ステータスごとの集計
      const shippedCount = app.lines?.filter(
        (l) => l.status === 'SHIPPED' || l.status === 'ACTIVATED'
      ).length || 0;

      const notActivatedCount = app.lines?.filter(
        (l) => l.status === 'NOT_ACTIVATED'
      ).length || 0;

      const returnedCount = app.lines?.filter(
        (l) => l.status === 'RETURNED'
      ).length || 0;

      // KYC画像の最新有効期限を取得
      const expiryDates = app.kycImages
        ?.filter((img) => img.expiryDate)
        .map((img) => img.expiryDate!) || [];

      const latestExpiryDate = expiryDates.length > 0
        ? expiryDates.reduce((a, b) => (a > b ? a : b))
        : null;

      return {
        ...app,
        applicationOrdinal: (app as any).applicationOrdinal || 1,
        stats: {
          lineCount: app.lineCount,
          shippedCount,
          notActivatedCount,
          returnedCount,
        },
        latestExpiryDate,
      };
    });
  }

  /**
   * 顧客申込作成（フロントエンド向けAPI用）
   *
   * @param serviceCode サービスコード（avaris, buppan, etc.）
   * @param input 申込入力データ
   * @param hashPasswordFn パスワードハッシュ化関数
   * @param uploadFileFn ファイルアップロード関数
   * @returns 作成された申込情報
   */
  async createCustomerApplication(
    serviceCode: string,
    input: CustomerApplicationInput,
    hashPasswordFn: (password: string) => Promise<string>,
    uploadFileFn: (bucket: string, path: string, buffer: Buffer, contentType: string) => Promise<void>
  ): Promise<CustomerApplicationResult> {
    logger.info('顧客申込作成開始', { serviceCode, email: input.customer.email });

    // サービス設定を取得
    const serviceConfig = getServiceConfig(serviceCode);

    // サービスを取得
    const service = await this.prisma.service.findUnique({
      where: { code: serviceCode },
    });

    if (!service) {
      throw new NotFoundError('サービスが見つかりません');
    }

    // プランと料金を取得
    const plan = await this.prisma.plan.findUnique({
      where: { id: input.planId },
      include: {
        pricings: true,
      },
    });

    if (!plan || !plan.isActive) {
      throw new NotFoundError('プランが見つかりません');
    }

    // 回線数に応じた単価を計算
    const applicablePricings = plan.pricings.sort((a, b) => a.minQuantity - b.minQuantity);

    if (applicablePricings.length === 0) {
      throw new ValidationError('該当する料金プランが見つかりません');
    }

    let unitPrice = applicablePricings[0].unitPrice;
    for (const pricing of applicablePricings) {
      if (input.lineCount >= pricing.minQuantity) {
        if (!pricing.maxQuantity || input.lineCount <= pricing.maxQuantity) {
          unitPrice = pricing.unitPrice;
        }
      }
    }

    // クーポン処理
    let couponId: string | null = null;
    let appliedCouponCode: string | null = null;
    if (input.couponCode) {
      const coupon = await this.prisma.coupon.findFirst({
        where: { code: input.couponCode, isActive: true },
        include: { pricings: true },
      });
      if (coupon) {
        const now = new Date();
        if (
          coupon.planId === input.planId &&
          now >= coupon.validFrom &&
          now <= coupon.validUntil &&
          (coupon.maxUsages === null || coupon.usageCount < coupon.maxUsages)
        ) {
          // CouponPricingティア価格 → フラット価格 → プラン価格（フォールバック）
          if (coupon.pricings && coupon.pricings.length > 0) {
            const sorted = [...coupon.pricings].sort((a: any, b: any) => a.minQuantity - b.minQuantity);
            unitPrice = sorted[0].unitPrice;
            for (const p of sorted) {
              if (input.lineCount >= p.minQuantity && (!p.maxQuantity || input.lineCount <= p.maxQuantity)) {
                unitPrice = p.unitPrice;
              }
            }
          } else if (coupon.unitPrice !== null) {
            unitPrice = coupon.unitPrice;
          }
          couponId = coupon.id;
          appliedCouponCode = coupon.code;
        }
      }
    }

    const totalAmount = unitPrice * input.lineCount;

    // メールアドレスの重複チェック（ユーザー）
    const existingUser = await this.prisma.user.findUnique({
      where: { email: input.customer.email },
    });

    if (existingUser) {
      throw new ConflictError('このメールアドレスは既に登録されています');
    }

    // パスワードハッシュ化
    const hashedPassword = await hashPasswordFn(input.password);

    // トランザクションで顧客、ユーザー、申込を作成
    const result = await this.prisma.$transaction(async (tx) => {
      // ユーザーを作成
      const user = await tx.user.create({
        data: {
          email: input.customer.email,
          password: hashedPassword,
          role: 'CUSTOMER',
          serviceId: service.id,
          isActive: true,
        },
      });

      // 顧客を作成
      const customer = await tx.customer.create({
        data: {
          user: { connect: { id: user.id } },
          type: input.customerType,
          email: input.customer.email,
          phone: input.customer.phone,
          lastName: input.customer.lastName,
          firstName: input.customer.firstName,
          lastNameKana: input.customer.lastNameKana,
          firstNameKana: input.customer.firstNameKana,
          birthDate: new Date(input.customer.birthDate),
          postalCode: input.customer.postalCode.replace('-', ''),
          prefecture: input.customer.prefecture,
          city: input.customer.city,
          address: input.customer.address,
          building: input.customer.building || null,
          companyName: input.customerType === 'CORPORATE' ? input.customer.companyName : null,
          companyNameKana: input.customerType === 'CORPORATE' ? input.customer.companyNameKana : null,
          establishedDate: input.customerType === 'CORPORATE' && input.customer.establishedDate ? new Date(input.customer.establishedDate) : null,
          representativeLastName: input.customerType === 'CORPORATE' ? input.customer.representativeLastName : null,
          representativeFirstName: input.customerType === 'CORPORATE' ? input.customer.representativeFirstName : null,
          representativeLastNameKana: input.customerType === 'CORPORATE' ? input.customer.representativeLastNameKana : null,
          representativeFirstNameKana: input.customerType === 'CORPORATE' ? input.customer.representativeFirstNameKana : null,
          companyPostalCode: input.customerType === 'CORPORATE' ? input.customer.companyPostalCode?.replace('-', '') : null,
          companyPrefecture: input.customerType === 'CORPORATE' ? input.customer.companyPrefecture : null,
          companyCity: input.customerType === 'CORPORATE' ? input.customer.companyCity : null,
          companyAddress: input.customerType === 'CORPORATE' ? input.customer.companyAddress : null,
          companyBuilding: input.customerType === 'CORPORATE' ? input.customer.companyBuilding : null,
        },
      });

      // 申込番号を生成（重複チェック付き）
      let applicationNumber: string;
      let attempts = 0;
      do {
        applicationNumber = this.generateApplicationNumber(serviceConfig.applicationNumberPrefix);
        const existing = await tx.application.findUnique({
          where: { applicationNumber },
        });
        if (!existing) break;
        attempts++;
      } while (attempts < 10);

      if (attempts >= 10) {
        throw new Error('申込番号の生成に失敗しました');
      }

      // 申込を作成
      const application = await tx.application.create({
        data: {
          applicationNumber,
          customerId: customer.id,
          serviceId: service.id,
          planId: plan.id,
          lineCount: input.lineCount,
          unitPrice,
          totalAmount,
          status: 'SUBMITTED',
          couponId,
          couponCode: appliedCouponCode,
        },
        include: {
          customer: true,
          plan: true,
        },
      });

      // 申込回線を作成
      const linesData = Array.from({ length: input.lineCount }, (_, i) => ({
        applicationId: application.id,
        lineNumber: i + 1,
        status: 'NOT_ACTIVATED' as const,
      }));

      await tx.applicationLine.createMany({
        data: linesData,
      });

      // クーポン利用回数を更新
      if (couponId) {
        await tx.coupon.update({
          where: { id: couponId },
          data: { usageCount: { increment: 1 } },
        });
      }

      return { application, applicationNumber };
    });

    // KYC書類をアップロード（トランザクション外）
    // 既にStorageパスが渡された場合はアップロード不要、DBへの登録のみ行う
    const applicationId = result.application.id;
    const timestamp = Date.now();

    // ID表面
    let resolvedIdFrontPath: string;
    if (input.idFrontPath) {
      // 既アップロード済みのパスを使用
      resolvedIdFrontPath = input.idFrontPath;
    } else if (input.idFront) {
      resolvedIdFrontPath = `kyc/${applicationId}/id_front_${timestamp}`;
      const idFrontBuffer = await this.fileToBuffer(input.idFront);
      await uploadFileFn('kyc', resolvedIdFrontPath, idFrontBuffer, input.idFront.type);
    } else {
      throw new Error('ID表面が見つかりません');
    }
    await this.prisma.kycImage.create({
      data: {
        applicationId,
        type: 'ID_FRONT',
        storagePath: resolvedIdFrontPath,
        status: 'PENDING',
        expiryDate: input.idExpiryDate || null,
      },
    });

    // ID裏面
    let resolvedIdBackPath: string;
    if (input.idBackPath) {
      resolvedIdBackPath = input.idBackPath;
    } else if (input.idBack) {
      resolvedIdBackPath = `kyc/${applicationId}/id_back_${timestamp}`;
      const idBackBuffer = await this.fileToBuffer(input.idBack);
      await uploadFileFn('kyc', resolvedIdBackPath, idBackBuffer, input.idBack.type);
    } else {
      throw new Error('ID裏面が見つかりません');
    }
    await this.prisma.kycImage.create({
      data: {
        applicationId,
        type: 'ID_BACK',
        storagePath: resolvedIdBackPath,
        status: 'PENDING',
        expiryDate: input.idExpiryDate || null,
      },
    });

    // 登記簿謄本（法人のみ）
    if (input.corporateRegistryPath) {
      await this.prisma.kycImage.create({
        data: {
          applicationId,
          type: 'CORPORATE_REGISTRY',
          storagePath: input.corporateRegistryPath,
          status: 'PENDING',
        },
      });
    } else if (input.corporateRegistry) {
      const corpPath = `kyc/${applicationId}/corporate_registry_${timestamp}`;
      const corpBuffer = await this.fileToBuffer(input.corporateRegistry);
      await uploadFileFn('kyc', corpPath, corpBuffer, input.corporateRegistry.type);
      await this.prisma.kycImage.create({
        data: {
          applicationId,
          type: 'CORPORATE_REGISTRY',
          storagePath: corpPath,
          status: 'PENDING',
        },
      });
    }

    logger.info('顧客申込作成完了', {
      applicationNumber: result.applicationNumber,
      applicationId: result.application.id,
    });

    return {
      success: true,
      applicationNumber: result.applicationNumber,
      application: result.application,
    };
  }

  /**
   * 申込番号を生成
   */
  private generateApplicationNumber(prefix: string): string {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `${prefix}${year}${month}${day}${random}`;
  }

  /**
   * ファイルをBufferに変換
   */
  private async fileToBuffer(file: File): Promise<Buffer> {
    const arrayBuffer = await file.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * 顧客の申込一覧を取得
   *
   * @param userId ユーザーID
   * @returns 申込一覧
   */
  async getCustomerApplications(userId: string): Promise<any[]> {
    logger.info('顧客申込一覧取得', { userId });

    // ユーザーに紐づく顧客を取得
    const customer = await this.prisma.customer.findFirst({
      where: {
        userId: userId,
      },
    });

    if (!customer) {
      logger.warn('顧客情報が見つかりません', { userId });
      return [];
    }

    // 申込履歴取得
    const applications = await this.prisma.application.findMany({
      where: {
        customerId: customer.id,
      },
      include: {
        plan: true,
        lines: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    logger.info('顧客申込一覧取得完了', {
      userId,
      customerId: customer.id,
      applicationCount: applications.length,
    });

    return applications;
  }

  /**
   * Create additional application (追加申込作成)
   * Additional applications are for existing customers and skip KYC
   */
  async createAdditionalApplication(
    userId: string,
    input: { planId: string; lineCount: number; couponCode?: string; kycImages?: { type: string; path: string; expiryDate?: string | null }[] }
  ): Promise<{ success: boolean; applicationNumber: string }> {
    // Validate line count (must be multiple of 10, minimum 10)
    if (input.lineCount < 10 || input.lineCount % 10 !== 0) {
      throw new ValidationError("回線数は10回線単位で指定してください");
    }

    // Fetch customer by userId
    const customer = await this.prisma.customer.findFirst({
      where: { userId },
    });

    if (!customer) {
      throw new NotFoundError("顧客情報が見つかりません");
    }

    // Fetch plan with pricings
    const plan = await this.prisma.plan.findUnique({
      where: { id: input.planId },
      include: {
        service: true,
        pricings: {
          orderBy: { minQuantity: "asc" },
        },
      },
    });

    if (!plan || !plan.isActive) {
      throw new ValidationError("選択されたプランは無効です");
    }

    if (plan.pricings.length === 0) {
      throw new ValidationError("プランの価格設定が見つかりません");
    }

    // Calculate unit price based on line count
    let unitPrice = plan.pricings[0].unitPrice;
    for (const pricing of plan.pricings) {
      if (input.lineCount >= pricing.minQuantity) {
        if (!pricing.maxQuantity || input.lineCount <= pricing.maxQuantity) {
          unitPrice = pricing.unitPrice;
        }
      }
    }

    // Process coupon if provided
    let couponId: string | null = null;
    let appliedCouponCode: string | null = null;
    if (input.couponCode) {
      const coupon = await this.prisma.coupon.findFirst({
        where: { code: input.couponCode, isActive: true },
        include: { pricings: true },
      });
      if (coupon) {
        const now = new Date();
        if (
          coupon.planId === input.planId &&
          now >= coupon.validFrom &&
          now <= coupon.validUntil &&
          (coupon.maxUsages === null || coupon.usageCount < coupon.maxUsages)
        ) {
          // CouponPricingティア価格 → フラット価格 → プラン価格（フォールバック）
          if (coupon.pricings && coupon.pricings.length > 0) {
            const sorted = [...coupon.pricings].sort((a: any, b: any) => a.minQuantity - b.minQuantity);
            unitPrice = sorted[0].unitPrice;
            for (const p of sorted) {
              if (input.lineCount >= p.minQuantity && (!p.maxQuantity || input.lineCount <= p.maxQuantity)) {
                unitPrice = p.unitPrice;
              }
            }
          } else if (coupon.unitPrice !== null) {
            unitPrice = coupon.unitPrice;
          }
          couponId = coupon.id;
          appliedCouponCode = coupon.code;
        }
      }
    }

    // Generate application number
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
    const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
    const applicationNumber = `AP${dateStr}${randomNum}`;

    // Calculate total amount
    const totalAmount = unitPrice * input.lineCount;

    // KYC再アップロードがある場合はPENDING、なければCOMPLETED
    const hasNewKyc = input.kycImages && input.kycImages.length > 0;
    const kycStatus = hasNewKyc ? "PENDING" : "COMPLETED";

    // Create application in transaction
    const application = await this.prisma.$transaction(async (tx) => {
      // Create application
      const newApplication = await tx.application.create({
        data: {
          applicationNumber,
          customerId: customer.id,
          serviceId: plan.serviceId,
          planId: plan.id,
          lineCount: input.lineCount,
          unitPrice,
          totalAmount,
          status: "SUBMITTED",
          kycStatus,
          couponId,
          couponCode: appliedCouponCode,
        },
      });

      // KYC画像を保存
      if (hasNewKyc && input.kycImages) {
        // 再アップロード: 新しいKYC画像を保存
        await tx.kycImage.createMany({
          data: input.kycImages.map((img) => ({
            applicationId: newApplication.id,
            type: img.type,
            storagePath: img.path,
            status: "PENDING",
            expiryDate: img.expiryDate ? new Date(img.expiryDate) : null,
          })),
        });
      } else {
        // KYC引き継ぎ: 前回の最新申込からkycImagesをコピー
        const prevApp = await tx.application.findFirst({
          where: { customerId: customer.id, id: { not: newApplication.id } },
          orderBy: { createdAt: "desc" },
          include: { kycImages: true },
        });
        if (prevApp && prevApp.kycImages.length > 0) {
          await tx.kycImage.createMany({
            data: prevApp.kycImages.map((img: { type: string; storagePath: string; expiryDate: Date | null }) => ({
              applicationId: newApplication.id,
              type: img.type,
              storagePath: img.storagePath,
              status: "APPROVED" as const,
              expiryDate: img.expiryDate,
            })),
          });
        }
      }

      // Create lines
      const linesData = Array.from({ length: input.lineCount }, (_, i) => ({
        applicationId: newApplication.id,
        lineNumber: i + 1,
        status: "NOT_ACTIVATED" as const,
      }));
      await tx.applicationLine.createMany({ data: linesData });

      // Update coupon usage count
      if (couponId) {
        await tx.coupon.update({
          where: { id: couponId },
          data: { usageCount: { increment: 1 } },
        });
      }

      return newApplication;
    });

    logger.info("Additional application created", { 
      applicationNumber, 
      customerId: customer.id,
      lineCount: input.lineCount 
    });

    return {
      success: true,
      applicationNumber: application.applicationNumber,
    };
  }
}
