import { checkDatabase } from '../repositories/health.repository.js';

export const getHealth = async () => {
  try {
    await checkDatabase();
    return {
      status: 'ok',
      database: 'ok'
    };
  } catch (error) {
    return {
      status: 'degraded',
      database: 'unavailable',
      error
    };
  }
};
