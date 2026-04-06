/**
 * Shipping Service
 *
 * 発送・配送に関するビジネスロジックを担当
 */

import { ShippingScanInput, ShippingScanResult, ShippingCompleteInput, ShippingCompleteResult, ShippingPendingResult, ShippingPendingApplication } from '@/entities';
import { ValidationError, NotFoundError } from '../shared/errors/custom-errors';
import { logger } from '../shared/utils/logger';
import type { PrismaClient } from '@prisma/client';
import { computeSimStatus } from '../repositories/sim.repository';

export class ShippingService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * SIMスキャンと回線への割り当て処理
   *
   * @param input スキャン入力データ
   * @returns スキャン結果
   */
  async scanAndAssign(input: ShippingScanInput): Promise<ShippingScanResult> {
    logger.info('SIMスキャン処理開始', {
      applicationLineId: input.applicationLineId,
      iccid: input.iccid,
    });

    // 1. 回線の存在確認
    const applicationLine = await this.prisma.applicationLine.findUnique({
      where: { id: input.applicationLineId },
      include: {
        application: {
          include: {
            plan: {
              include: {
                usageTags: {
                  include: {
                    usageTag: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!applicationLine) {
      throw new NotFoundError('回線が見つかりません');
    }

    // 2. 申込ステータスチェック
    if (applicationLine.application.status !== 'PAID') {
      throw new ValidationError('この申込は発送処理できる状態ではありません');
    }

    // 3. SIM重複割り当てチェック
    if (applicationLine.simId) {
      throw new ValidationError('この回線には既にSIMが割り当てられています');
    }

    // 4. SIMの存在確認
    const sim = await this.prisma.sim.findUnique({
      where: { iccid: input.iccid },
      include: {
        applicationLines: {
          select: { status: true, updatedAt: true },
        },
      },
    });

    if (!sim) {
      throw new NotFoundError('このICCIDのSIMは登録されていません');
    }

    // 5. SIMステータスチェック（ApplicationLineから導出）
    const simStatus = computeSimStatus(sim.applicationLines || []);
    if (simStatus !== 'IN_STOCK') {
      throw new ValidationError(
        `このSIMは利用中のため割り当てできません`
      );
    }

    // 6. プランの用途タグに基づいてSIMの利用可能性をチェック
    const planUsageTags = applicationLine.application.plan.usageTags.map(
      (ut) => ut.usageTag.id
    );

    const consumedTagIds = (sim.consumedTagIds as number[]) || [];
    const conflictingTags = planUsageTags.filter((tagId) =>
      consumedTagIds.includes(tagId)
    );

    if (conflictingTags.length > 0) {
      throw new ValidationError(
        'このSIMは選択されたプランの用途では使用できません（既に同じ用途で使用済み）'
      );
    }

    // 7. ApplicationLineにSIMを紐付け
    const updatedLine = await this.prisma.applicationLine.update({
      where: { id: input.applicationLineId },
      data: {
        simId: sim.iccid,
        msisdn: sim.msisdn,
        status: 'ACTIVATED',
        contractMonth: input.contractMonth,
        lineTagId: input.lineTagId,
        lineReserveTagId: input.lineReserveTagId,
      },
    });

    logger.info('SIMスキャン処理完了', {
      applicationLineId: input.applicationLineId,
      iccid: sim.iccid,
      msisdn: sim.msisdn,
    });

    return {
      line: {
        id: updatedLine.id,
        lineNumber: updatedLine.lineNumber,
        simId: updatedLine.simId,
        msisdn: updatedLine.msisdn,
        status: updatedLine.status,
      },
      sim: {
        iccid: sim.iccid,
        msisdn: sim.msisdn,
        carrierType: sim.carrierType,
        plan: sim.plan,
      },
    };
  }

  /**
   * 発送完了処理
   *
   * @param input 発送入力データ
   * @returns 発送完了結果
   */
  async completeShipping(input: ShippingCompleteInput): Promise<ShippingCompleteResult> {
    logger.info('発送処理開始', {
      applicationId: input.applicationId,
      lineIds: input.lineIds,
    });

    // 申込の存在確認
    const application = await this.prisma.application.findUnique({
      where: { id: input.applicationId },
      include: {
        customer: true,
        plan: {
          include: {
            usageTags: {
              include: {
                usageTag: true,
              },
            },
          },
        },
        service: true,
        lines: {
          where: { id: { in: input.lineIds } },
          include: {
            sim: true,
          },
        },
      },
    });

    if (!application) {
      throw new NotFoundError('申込が見つかりません');
    }

    if (application.status !== 'PAID') {
      throw new ValidationError('この申込は発送処理できる状態ではありません');
    }

    // 選択された回線がすべてSIM割当済みか確認
    const unassignedLines = application.lines.filter((line) => !line.simId);
    if (unassignedLines.length > 0) {
      throw new ValidationError(
        `${unassignedLines.length}件の回線にSIMが割り当てられていません`
      );
    }

    // プランの用途タグを取得
    const usageTagIds = application.plan.usageTags.map((ut) => ut.usageTag.id);

    // トランザクションで発送処理を実行
    const result = await this.prisma.$transaction(async (tx) => {
      const now = new Date();

      // 対象回線（SIM割当済みのみ）
      const assignedLines = application.lines.filter((line) => line.sim);

      // Step1: Contract を並列作成
      const contractResults = await Promise.all(
        assignedLines.map(async (line) => {
          const contract = await tx.contract.create({
            data: {
              iccid: line.sim!.iccid,
              serviceName: application.service.name,
              customerId: application.customer.id,
              contractStart: now,
              status: 'SHIPPED',
              shippedAt: now,
            },
          });
          const currentConsumedTagIds = (line.sim!.consumedTagIds as number[]) || [];
          return {
            contract,
            lineId: line.id,
            iccid: line.sim!.iccid,
            newConsumedTagIds: [...new Set([...currentConsumedTagIds, ...usageTagIds])],
          };
        })
      );

      // Step2: ContractUsageTag を createMany で一括挿入
      if (usageTagIds.length > 0 && contractResults.length > 0) {
        await tx.contractUsageTag.createMany({
          data: contractResults.flatMap(({ contract }) =>
            usageTagIds.map((tagId) => ({
              contractId: contract.id,
              usageTagId: tagId,
              appliedAt: now,
            }))
          ),
        });
      }

      // Step3: ApplicationLine + SIM を並列更新
      await Promise.all([
        ...contractResults.map(({ lineId, contract }) =>
          tx.applicationLine.update({
            where: { id: lineId },
            data: {
              contractId: contract.id,
              status: 'SHIPPED',
              shippedAt: now,
            },
          })
        ),
        ...contractResults.map(({ iccid, contract, newConsumedTagIds }) =>
          tx.sim.update({
            where: { iccid },
            data: {
              // status はApplicationLineから導出するため更新不要
              currentContractId: contract.id,
              consumedTagIds: newConsumedTagIds,
            },
          })
        ),
      ]);

      const contracts = contractResults.map((r) => r.contract);

      // 5. Application更新
      // 全回線発送済みならSHIPPING、一部ならそのまま
      const allLines = await tx.applicationLine.findMany({
        where: { applicationId: application.id },
      });
      const allShipped = allLines.every(
        (l) => l.status === 'SHIPPED' || l.status === 'ACTIVATED'
      );

      const updatedApplication = await tx.application.update({
        where: { id: application.id },
        data: {
          status: allShipped ? 'SHIPPING' : 'PAID',
        },
      });

      return {
        application: updatedApplication,
        contracts,
        shippedLineCount: application.lines.length,
      };
    });

    logger.info('発送処理完了', {
      applicationId: input.applicationId,
      shippedLineCount: result.shippedLineCount,
      contractCount: result.contracts.length,
    });

    return {
      applicationStatus: result.application.status,
      shippedLineCount: result.shippedLineCount,
      contractCount: result.contracts.length,
    };
  }

  /**
   * 発送待ち申込一覧取得
   *
   * @param serviceCode サービスコード
   * @param page ページ番号
   * @param pageSize ページサイズ
   * @returns 発送待ち申込一覧
   */
  async getShippingPending(
    serviceCode: string,
    page: number,
    pageSize: number
  ): Promise<ShippingPendingResult> {
    logger.info('発送待ち一覧取得開始', { serviceCode, page });

    // サービスを取得
    const service = await this.prisma.service.findUnique({
      where: { code: serviceCode },
    });

    if (!service) {
      throw new NotFoundError('サービスが見つかりません');
    }

    // PAID状態の申込を取得（入金確認済み = 発送待ち）
    const where = {
      serviceId: service.id,
      status: 'PAID' as const,
    };

    const [applications, totalCount] = await Promise.all([
      this.prisma.application.findMany({
        where,
        include: {
          customer: true,
          plan: {
            include: {
              usageTags: {
                include: {
                  usageTag: true,
                },
              },
            },
          },
          lines: {
            include: {
              sim: {
                include: {
                  applicationLines: {
                    select: { status: true, updatedAt: true },
                  },
                },
              },
            },
            orderBy: { lineNumber: 'asc' },
          },
        },
        orderBy: { paidAt: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.application.count({ where }),
    ]);

    logger.info('発送待ち一覧取得完了', {
      serviceCode,
      count: applications.length,
    });

    return {
      applications: (applications.map((app) => ({
        id: app.id,
        applicationNumber: app.applicationNumber,
        customer: {
          id: app.customer.id,
          type: app.customer.type,
          name:
            app.customer.type === 'CORPORATE'
              ? app.customer.companyName || ''
              : `${app.customer.lastName} ${app.customer.firstName}`,
          email: app.customer.email,
          phone: app.customer.phone,
          postalCode: app.customer.postalCode,
          prefecture: app.customer.prefecture,
          city: app.customer.city,
          address: app.customer.address,
          building: app.customer.building,
        },
        plan: {
          id: app.plan.id,
          name: app.plan.name,
          usageTags: app.plan.usageTags.map((ut) => ({
            id: ut.usageTag.id,
            code: ut.usageTag.code,
            name: ut.usageTag.name,
          })),
        },
        lineCount: app.lineCount,
        totalAmount: app.totalAmount,
        paidAt: app.paidAt,
        createdAt: app.createdAt,
        lines: app.lines.map((line) => ({
          id: line.id,
          lineNumber: line.lineNumber,
          simId: line.simId,
          msisdn: line.msisdn,
          status: line.status,
          sim: line.sim
            ? {
                iccid: line.sim.iccid,
                msisdn: line.sim.msisdn,
                carrierType: line.sim.carrierType,
                status: computeSimStatus(line.sim.applicationLines || []),
              }
            : null,
        })),
        assignedCount: app.lines.filter((l) => l.simId).length,
      })) as unknown as ShippingPendingApplication[]),
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
      },
    };
  }
}