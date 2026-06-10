import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';

const SHIPROCKET_BASE_URL =
  process.env.SHIPROCKET_BASE_URL || 'https://apiv2.shiprocket.in/v1/external';

let shiprocketToken: string | null = null;
let tokenExpiry: Date | null = null;

/**
 * Authenticate with Shiprocket and get a JWT token.
 * Tokens expire after 10 days — we refresh every 9 days.
 */
export const getShiprocketToken = async (): Promise<string> => {
  const now = new Date();

  // Return cached token if still valid
  if (shiprocketToken && tokenExpiry && now < tokenExpiry) {
    return shiprocketToken;
  }

  try {
    const response = await axios.post(`${SHIPROCKET_BASE_URL}/auth/login`, {
      email: process.env.SHIPROCKET_EMAIL,
      password: process.env.SHIPROCKET_PASSWORD,
    });

    shiprocketToken = response.data.token as string;
    // Cache for 9 days
    tokenExpiry = new Date(now.getTime() + 9 * 24 * 60 * 60 * 1000);
    logger.info('✅ Shiprocket token refreshed');
    return shiprocketToken;
  } catch (error) {
    logger.error('❌ Shiprocket authentication failed:', error);
    throw new Error('Failed to authenticate with Shiprocket');
  }
};

/**
 * Get an authenticated Shiprocket Axios instance
 */
export const getShiprocketClient = async (): Promise<AxiosInstance> => {
  const token = await getShiprocketToken();
  return axios.create({
    baseURL: SHIPROCKET_BASE_URL,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
};

export { SHIPROCKET_BASE_URL };
