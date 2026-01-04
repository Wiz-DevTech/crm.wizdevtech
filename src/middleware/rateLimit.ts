const rateLimits = new Map<string, number[]>();

export function rateLimit(key: string, limit: number = 100) {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  
  const requests = rateLimits.get(key) || [];
  const recentRequests = requests.filter(time => now - time < windowMs);
  
  if (recentRequests.length >= limit) {
    return { allowed: false, remaining: 0 };
  }
  
  recentRequests.push(now);
  rateLimits.set(key, recentRequests);
  
  return { allowed: true, remaining: limit - recentRequests.length };
}