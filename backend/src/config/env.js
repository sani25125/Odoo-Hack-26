import 'dotenv/config';

const requiredEnvironment = (name, fallback) => {
  const value = process.env[name] || fallback;

  if (!value) {
    throw new Error('Missing required environment variable: ' + name);
  }

  return value;
};

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4000),
  frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  databaseUrl: requiredEnvironment('DATABASE_URL', ''),
  dbPoolMax: Number(process.env.DB_POOL_MAX || 10)
};

if (!Number.isInteger(env.port) || env.port <= 0) {
  throw new Error('PORT must be a positive integer');
}

if (!Number.isInteger(env.dbPoolMax) || env.dbPoolMax <= 0) {
  throw new Error('DB_POOL_MAX must be a positive integer');
}
