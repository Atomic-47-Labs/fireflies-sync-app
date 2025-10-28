// Token Bucket Rate Limiter for Fireflies API
// Business accounts: 60 requests per minute

import { API_RATE_LIMIT, API_RATE_WINDOW, API_REQUEST_DELAY } from '../../constants';
import { sleep } from '../utils';
import { RateLimitError } from '../../types';

interface QueuedRequest<T> {
  execute: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: any) => void;
  priority: number;
  id: string;
}

export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private maxTokens: number;
  private refillRate: number; // tokens per millisecond
  private queue: QueuedRequest<any>[] = [];
  private processing: boolean = false;
  private requestDelay: number;

  constructor(
    maxRequests: number = API_RATE_LIMIT,
    windowMs: number = API_RATE_WINDOW,
    requestDelay: number = API_REQUEST_DELAY
  ) {
    this.maxTokens = maxRequests;
    this.tokens = maxRequests;
    this.lastRefill = Date.now();
    this.refillRate = maxRequests / windowMs;
    this.requestDelay = requestDelay;
  }

  /**
   * Refill tokens based on time elapsed
   */
  private refillTokens(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const tokensToAdd = elapsed * this.refillRate;

    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  /**
   * Check if we have tokens available
   */
  private hasTokens(): boolean {
    this.refillTokens();
    return this.tokens >= 1;
  }

  /**
   * Consume a token
   */
  private consumeToken(): boolean {
    this.refillTokens();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }

  /**
   * Calculate time until next token is available
   */
  private timeUntilNextToken(): number {
    this.refillTokens();
    if (this.tokens >= 1) return 0;
    
    const tokensNeeded = 1 - this.tokens;
    return Math.ceil(tokensNeeded / this.refillRate);
  }

  /**
   * Add request to queue with priority
   */
  private enqueue<T>(
    execute: () => Promise<T>,
    priority: number = 0,
    id: string = `req-${Date.now()}-${Math.random()}`
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({ execute, resolve, reject, priority, id });
      
      // Sort queue by priority (higher priority first)
      this.queue.sort((a, b) => b.priority - a.priority);
      
      // Start processing if not already
      if (!this.processing) {
        this.processQueue();
      }
    });
  }

  /**
   * Process queued requests
   */
  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      // Wait for token availability
      while (!this.hasTokens()) {
        const waitTime = this.timeUntilNextToken();
        await sleep(Math.max(waitTime, 100)); // Wait at least 100ms
      }

      // Get next request from queue
      const request = this.queue.shift();
      if (!request) break;

      // Consume token and execute request
      if (this.consumeToken()) {
        try {
          const result = await request.execute();
          request.resolve(result);
          
          // Add delay between requests to be safe
          if (this.queue.length > 0) {
            await sleep(this.requestDelay);
          }
        } catch (error) {
          request.reject(error);
        }
      } else {
        // Should not happen, but handle gracefully
        this.queue.unshift(request);
        await sleep(100);
      }
    }

    this.processing = false;
  }

  /**
   * Execute a request with rate limiting
   */
  async execute<T>(
    fn: () => Promise<T>,
    priority: number = 0,
    id?: string
  ): Promise<T> {
    // If we have tokens available and queue is empty, execute immediately
    if (this.queue.length === 0 && this.consumeToken()) {
      try {
        return await fn();
      } catch (error) {
        // If rate limit error, re-queue with delay
        if (error instanceof RateLimitError) {
          await sleep(error.retryAfter || 60000);
          return this.enqueue(fn, priority, id);
        }
        throw error;
      }
    }

    // Otherwise, add to queue
    return this.enqueue(fn, priority, id);
  }

  /**
   * Get current rate limiter status
   */
  getStatus() {
    this.refillTokens();
    return {
      availableTokens: Math.floor(this.tokens),
      maxTokens: this.maxTokens,
      queueLength: this.queue.length,
      processing: this.processing,
      timeUntilNextToken: this.timeUntilNextToken()
    };
  }

  /**
   * Clear the queue
   */
  clearQueue(): void {
    this.queue.forEach(req => {
      req.reject(new Error('Queue cleared'));
    });
    this.queue = [];
  }

  /**
   * Remove specific request from queue
   */
  removeFromQueue(id: string): boolean {
    const index = this.queue.findIndex(req => req.id === id);
    if (index !== -1) {
      this.queue[index].reject(new Error('Request cancelled'));
      this.queue.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Reset rate limiter
   */
  reset(): void {
    this.tokens = this.maxTokens;
    this.lastRefill = Date.now();
    this.clearQueue();
  }
}

// Export singleton instance
export const rateLimiter = new RateLimiter();

