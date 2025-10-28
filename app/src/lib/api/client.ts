// Fireflies API Client
import { GraphQLClient } from 'graphql-request';
import { FIREFLIES_API_URL } from '../../constants';
import { rateLimiter } from './rate-limiter';
import { 
  APIError, 
  AuthError, 
  NetworkError, 
  RateLimitError,
  type FirefliesTranscript,
  type FirefliesUser 
} from '../../types';
import { GET_USER_QUERY, GET_TRANSCRIPTS_QUERY, GET_TRANSCRIPT_QUERY } from './queries';
import { retry } from '../utils';

export class FirefliesAPIClient {
  private client: GraphQLClient | null = null;
  private apiKey: string | null = null;

  constructor(apiKey?: string) {
    if (apiKey) {
      this.setApiKey(apiKey);
    }
  }

  /**
   * Set API key and initialize client
   */
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
    this.client = new GraphQLClient(FIREFLIES_API_URL, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Clear API key and client
   */
  clearApiKey(): void {
    this.apiKey = null;
    this.client = null;
  }

  /**
   * Check if client is initialized
   */
  private ensureInitialized(): void {
    if (!this.client || !this.apiKey) {
      throw new AuthError('API key not set. Please set API key first.');
    }
  }

  /**
   * Execute GraphQL request with rate limiting and error handling
   */
  private async request<T>(
    query: string,
    variables?: Record<string, any>,
    priority: number = 0
  ): Promise<T> {
    this.ensureInitialized();

    return rateLimiter.execute(async () => {
      try {
        const response = await retry(
          async () => this.client!.request<T>(query, variables),
          3,
          1000,
          30000,
          2
        );
        return response;
      } catch (error: any) {
        // Log detailed error for debugging
        console.error('API Request Error:', {
          message: error.message,
          response: error.response,
          status: error.response?.status,
          errors: error.response?.errors,
        });

        // Handle different error types
        if (error.response) {
          const status = error.response.status;
          const message = error.response.errors?.[0]?.message || error.message;

          // Bad Request - often means invalid API key or malformed query
          if (status === 400) {
            throw new APIError(
              `Bad Request: ${message}. Please check your API key and try again.`,
              status
            );
          }

          // Rate limit error
          if (status === 429) {
            const retryAfter = parseInt(error.response.headers?.['retry-after'] || '60');
            throw new RateLimitError(retryAfter * 1000);
          }

          // Authentication error
          if (status === 401 || status === 403) {
            throw new AuthError(`Authentication failed: ${message}`);
          }

          // API error
          throw new APIError(`API error: ${message}`, status);
        }

        // Network error
        if (error.message?.includes('fetch') || error.message?.includes('network')) {
          throw new NetworkError(`Network error: ${error.message}`);
        }

        // Generic error
        throw new APIError(error.message || 'Unknown API error');
      }
    }, priority);
  }

  /**
   * Get user information (for validation)
   */
  async getUser(): Promise<FirefliesUser> {
    const response = await this.request<{ user: FirefliesUser }>(
      GET_USER_QUERY,
      undefined,
      10 // High priority
    );
    return response.user;
  }

  /**
   * Validate API key by fetching user info
   */
  async validateApiKey(): Promise<boolean> {
    try {
      await this.getUser();
      return true;
    } catch (error) {
      if (error instanceof AuthError) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get transcripts with pagination - using direct fetch
   */
  async getTranscriptsDirect(options: {
    fromDate?: string;
    toDate?: string;
    limit?: number;
    skip?: number;
  } = {}): Promise<FirefliesTranscript[]> {
    this.ensureInitialized();

    const variables = {
      fromDate: options.fromDate,
      toDate: options.toDate,
      limit: options.limit || 50,
      skip: options.skip || 0,
    };

    console.log('Making direct fetch request with variables:', variables);

    const response = await fetch(FIREFLIES_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: GET_TRANSCRIPTS_QUERY,
        variables,
      }),
    });

    const text = await response.text();
    console.log('Direct fetch response status:', response.status);
    console.log('Direct fetch response body:', text);

    if (!response.ok) {
      throw new APIError(`HTTP ${response.status}: ${text}`, response.status);
    }

    const data = JSON.parse(text);
    
    if (data.errors) {
      throw new APIError(`GraphQL errors: ${JSON.stringify(data.errors)}`, response.status);
    }

    return data.data.transcripts;
  }

  /**
   * Get transcripts (without limit returns all)
   */
  async getTranscripts(options: {
    limit?: number;
  } = {}): Promise<FirefliesTranscript[]> {
    const { limit } = options;
    
    // If limit is provided, use it; otherwise omit to get all transcripts
    const variables = limit ? { limit } : {};
    
    console.log(`getTranscripts: Fetching transcripts${limit ? ` (limit: ${limit})` : ' (no limit - all transcripts)'}`);

    const response = await this.request<{ transcripts: FirefliesTranscript[] }>(
      GET_TRANSCRIPTS_QUERY,
      variables
    );

    console.log(`✅ Received ${response.transcripts.length} transcripts from API`);

    return response.transcripts;
  }

  /**
   * Get all transcripts (no limit = returns all)
   */
  async getAllTranscripts(options: {
    onProgress?: (progress: { current: number; total?: number }) => void;
  } = {}): Promise<FirefliesTranscript[]> {
    console.log('getAllTranscripts: Fetching all transcripts (no limit)...');
    
    // Don't pass any limit - Fireflies API returns all transcripts by default
    const transcripts = await this.getTranscripts();

    console.log(`✅ getAllTranscripts: Retrieved ${transcripts.length} total transcripts`);

    if (options.onProgress) {
      options.onProgress({
        current: transcripts.length,
        total: transcripts.length,
      });
    }

    return transcripts;
  }

  /**
   * Get single transcript with full details
   */
  async getTranscript(id: string): Promise<FirefliesTranscript> {
    const response = await this.request<{ transcript: FirefliesTranscript }>(
      GET_TRANSCRIPT_QUERY,
      { id },
      5 // Medium-high priority
    );

    return response.transcript;
  }

  /**
   * Get rate limiter status
   */
  getRateLimiterStatus() {
    return rateLimiter.getStatus();
  }

  /**
   * Test connection to API
   */
  async testConnection(): Promise<{
    success: boolean;
    message: string;
    user?: FirefliesUser;
  }> {
    try {
      const user = await this.getUser();
      return {
        success: true,
        message: `Connected as ${user.email}`,
        user,
      };
    } catch (error) {
      if (error instanceof AuthError) {
        return {
          success: false,
          message: 'Authentication failed. Please check your API key.',
        };
      }
      if (error instanceof NetworkError) {
        return {
          success: false,
          message: 'Network error. Please check your internet connection.',
        };
      }
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// Export singleton instance (can be initialized later)
export const apiClient = new FirefliesAPIClient();

