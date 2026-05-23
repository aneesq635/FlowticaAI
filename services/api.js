import { Alert } from 'react-native';

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL
const TIMEOUT_MS = 30000;    // 10 seconds — default
const AI_TIMEOUT_MS = 90000;  // 90 seconds — for AI/orchestration endpoints

class ApiClient {
  constructor() {
    this.baseUrl = BASE_URL;
    console.log(`[API CLIENT] Initialized with BASE_URL: ${this.baseUrl}`);
  }

  /**
   * Helper to execute a fetch request with timeout support and rich logging.
   */
  async request(endpoint, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;
    const method = options.method || 'GET';
    const requestId = Math.random().toString(36).substring(7);

    console.log(`\n[API REQUEST][${requestId}] === START ===`);
    console.log(`[API REQUEST][${requestId}] URL: ${url}`);
    console.log(`[API REQUEST][${requestId}] Method: ${method}`);
    if (options.body) {
      console.log(`[API REQUEST][${requestId}] Body:`, options.body);
    }
    if (options.headers) {
      console.log(`[API REQUEST][${requestId}] Headers:`, JSON.stringify(options.headers));
    }

    // Set up AbortController for timeout handling (per-request override supported)
    const timeout = options.timeout ?? TIMEOUT_MS;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.warn(`[API REQUEST][${requestId}] TIMEOUT triggered after ${timeout}ms`);
      controller.abort();
    }, timeout);

    const fetchOptions = {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);

      console.log(`[API RESPONSE][${requestId}] Status: ${response.status} ${response.statusText}`);

      const contentType = response.headers.get('content-type') || '';
      let responseData = null;

      if (contentType.includes('application/json')) {
        responseData = await response.json();
        console.log(`[API RESPONSE][${requestId}] Body:`, JSON.stringify(responseData));
      } else {
        const textData = await response.text();
        console.log(`[API RESPONSE][${requestId}] Raw Text Body (Non-JSON):`, textData.substring(0, 500));

        // If it's an HTML response, it's typically an unexpected server error page (like a 404 or 500)
        if (contentType.includes('text/html')) {
          throw new Error(`Server returned unexpected HTML error page (Status: ${response.status})`);
        }
        responseData = { text: textData };
      }

      if (!response.ok) {
        const errorMessage = responseData?.error || responseData?.message || `Request failed with status ${response.status}`;
        throw new Error(errorMessage);
      }

      console.log(`[API REQUEST][${requestId}] === SUCCESS ===\n`);
      return responseData;

    } catch (error) {
      clearTimeout(timeoutId);

      let errorDescription = error.message;
      if (error.name === 'AbortError') {
        const timeout = options.timeout ?? TIMEOUT_MS;
        errorDescription = `Network timeout after ${timeout}ms. Server might be down or unreachable.`;
      }

      console.error(`[API REQUEST][${requestId}] === FAILURE ===`);
      console.error(`[API REQUEST][${requestId}] Error:`, errorDescription);
      console.error(`[API REQUEST][${requestId}] Full Error Object:`, error);
      console.error(`[API REQUEST][${requestId}] =====================\n`);

      // Avoid blocking operations, but throw to be handled or trigger UI notification
      throw {
        success: false,
        error: errorDescription,
        status: error.status || 'NETWORK_ERROR',
        originalError: error
      };
    }
  }

  async get(endpoint, headers = {}) {
    return this.request(endpoint, { method: 'GET', headers });
  }

  async post(endpoint, body = {}, headers = {}) {
    return this.request(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  }

  /** POST with extended 90s timeout — use for AI/orchestration endpoints */
  async aiPost(endpoint, body = {}, headers = {}) {
    return this.request(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      timeout: AI_TIMEOUT_MS,
    });
  }

  async put(endpoint, body = {}, headers = {}) {
    return this.request(endpoint, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
    });
  }

  async delete(endpoint, body = null, headers = {}) {
    return this.request(endpoint, {
      method: 'DELETE',
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * Safe request helper that catches all errors internally and returns standard error object.
   * Useful for background tasks where you don't want throws to crash the UI.
   */
  async safeRequest(endpoint, method = 'GET', body = null, headers = {}) {
    try {
      const options = { method, headers };
      if (body) options.body = JSON.stringify(body);
      return await this.request(endpoint, options);
    } catch (err) {
      return err; // Returns the standardized error object
    }
  }

  /**
   * Diagnostic helper to test reachability.
   */
  async checkHealth() {
    try {
      const data = await this.request('/health');
      return { ok: true, data };
    } catch (err) {
      return { ok: false, error: err.error || err.message };
    }
  }
}

const api = new ApiClient();
export default api;
