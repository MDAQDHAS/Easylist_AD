import { apiClient } from './client';
import { getAccessToken } from './authToken';

apiClient.setTokenProvider(getAccessToken);