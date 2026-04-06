/**
 * サービス別設定
 */

export interface ServiceConfig {
  code: string;
  name: string;
  applicationNumberPrefix: string;
}

export const SERVICE_CONFIGS: Record<string, ServiceConfig> = {
  avaris: {
    code: 'avaris',
    name: 'Avaris',
    applicationNumberPrefix: 'BP',
  },
  buppan: {
    code: 'buppan',
    name: 'Buppan',
    applicationNumberPrefix: 'BP',
  },
  machinegun: {
    code: 'machinegun',
    name: 'Machine Gun',
    applicationNumberPrefix: 'MG',
  },
  maeda: {
    code: 'maeda',
    name: 'Maeda',
    applicationNumberPrefix: 'MD',
  },
  versus: {
    code: 'versus',
    name: 'Versus',
    applicationNumberPrefix: 'BP',
  },
};

export function getServiceConfig(serviceCode: string): ServiceConfig {
  const config = SERVICE_CONFIGS[serviceCode];
  if (!config) {
    throw new Error(`Unknown service code: ${serviceCode}`);
  }
  return config;
}
