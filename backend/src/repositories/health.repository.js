import { query } from '../database/pool.js';

export const checkDatabase = async () => {
  await query('SELECT 1');
  return true;
};
