'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface ApiRequestContextType {
  requestCount: number;
  incrementRequestCount: () => void;
  resetRequestCount: () => void;
}

const ApiRequestContext = createContext<ApiRequestContextType | undefined>(undefined);

// Global function to increment request count from anywhere (even outside React components)
export function incrementApiRequestCount() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('increment-api-request'));
  }
}

/**
 * Helper function to measure API requests for a specific action.
 * 
 * Usage example:
 * ```typescript
 * import { measureApiRequests } from '@/app/anilist/contexts/ApiRequestContext';
 * 
 * // Measure how many requests an action takes
 * await measureApiRequests('Load media with scores', async () => {
 *   return await fetchMediaWithScores(12345, token);
 * });
 * // Console will show: "Action 'Load media with scores' completed - 2 requests in 450ms"
 * ```
 */
export function measureApiRequests(actionName: string, action: () => Promise<any> | any): Promise<any> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      resolve(action());
      return;
    }

    const startCount = (window as any).__apiRequestCount || 0;
    const startTime = Date.now();
    
    console.log(`[ApiRequestCounter] 🎬 Starting action: "${actionName}" (current count: ${startCount})`);
    
    // Track requests during action
    let requestCount = 0;
    const handleIncrement = () => {
      requestCount++;
    };
    
    window.addEventListener('increment-api-request', handleIncrement);
    
    try {
      const result = action();
      
      if (result instanceof Promise) {
        result
          .then((data) => {
            const endTime = Date.now();
            const duration = endTime - startTime;
            window.removeEventListener('increment-api-request', handleIncrement);
            console.log(`[ApiRequestCounter] ✅ Action "${actionName}" completed - ${requestCount} requests in ${duration}ms`);
            resolve(data);
          })
          .catch((error) => {
            const endTime = Date.now();
            const duration = endTime - startTime;
            window.removeEventListener('increment-api-request', handleIncrement);
            console.log(`[ApiRequestCounter] ❌ Action "${actionName}" failed - ${requestCount} requests in ${duration}ms`);
            reject(error);
          });
      } else {
        const endTime = Date.now();
        const duration = endTime - startTime;
        window.removeEventListener('increment-api-request', handleIncrement);
        console.log(`[ApiRequestCounter] ✅ Action "${actionName}" completed - ${requestCount} requests in ${duration}ms`);
        resolve(result);
      }
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      window.removeEventListener('increment-api-request', handleIncrement);
      console.log(`[ApiRequestCounter] ❌ Action "${actionName}" failed - ${requestCount} requests in ${duration}ms`);
      reject(error);
    }
  });
}

export function ApiRequestProvider({ children }: { children: ReactNode }) {
  const [requestCount, setRequestCount] = useState<number>(0);

  useEffect(() => {
    // Expose increment function globally for use in lib functions
    if (typeof window !== 'undefined') {
      window.incrementApiRequestCount = () => {
        setRequestCount(prev => {
          const newCount = prev + 1;
          console.log(`[ApiRequestCounter] 📊 Request count incremented: ${newCount}`);
          return newCount;
        });
      };
    }

    const handleIncrement = () => {
      setRequestCount(prev => {
        const newCount = prev + 1;
        console.log(`[ApiRequestCounter] 📊 Request count incremented: ${newCount}`);
        return newCount;
      });
    };

    window.addEventListener('increment-api-request', handleIncrement);
    return () => {
      window.removeEventListener('increment-api-request', handleIncrement);
      if (typeof window !== 'undefined') {
        delete window.incrementApiRequestCount;
      }
    };
  }, []);

  const incrementRequestCount = () => {
    setRequestCount(prev => prev + 1);
  };

  const resetRequestCount = () => {
    console.log('[ApiRequestCounter] 🔄 Resetting request count to 0');
    setRequestCount(0);
  };

  useEffect(() => {
    // Expose reset function globally
    if (typeof window !== 'undefined') {
      window.resetApiRequestCount = () => {
        console.log('[ApiRequestCounter] 🔄 Resetting request count to 0 (global)');
        setRequestCount(0);
      };
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete window.resetApiRequestCount;
      }
    };
  }, []);

  return (
    <ApiRequestContext.Provider value={{ requestCount, incrementRequestCount, resetRequestCount }}>
      {children}
    </ApiRequestContext.Provider>
  );
}

export function useApiRequest() {
  const context = useContext(ApiRequestContext);
  if (context === undefined) {
    throw new Error('useApiRequest must be used within an ApiRequestProvider');
  }
  return context;
}
