import { NextRequest } from 'next/server';
import { prisma } from '@/lib/database';
import { getProfitLoss } from '@/controllers/profit-loss.controller';

export async function GET(request: NextRequest) {
  return await getProfitLoss(request, prisma);
}
