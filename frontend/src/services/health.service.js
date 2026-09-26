import { apiRequest } from './api-client.js';

export const getHealth = () => apiRequest('/health');
