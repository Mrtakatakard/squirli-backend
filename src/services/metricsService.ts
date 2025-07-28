import { register, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';
import logger from '../utils/logger';

export class MetricsService {
  // HTTP Metrics
  private static httpRequestsTotal = new Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code']
  });

  private static httpRequestDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route'],
    buckets: [0.1, 0.5, 1, 2, 5, 10]
  });

  // Security Metrics
  private static securityEventsTotal = new Counter({
    name: 'security_events_total',
    help: 'Total number of security events',
    labelNames: ['event_type', 'severity', 'ip_address']
  });

  private static failedLoginAttempts = new Counter({
    name: 'failed_login_attempts_total',
    help: 'Total number of failed login attempts',
    labelNames: ['ip_address', 'user_agent']
  });

  private static rateLimitExceeded = new Counter({
    name: 'rate_limit_exceeded_total',
    help: 'Total number of rate limit violations',
    labelNames: ['ip_address', 'endpoint']
  });

  private static blacklistedIPs = new Gauge({
    name: 'blacklisted_ips_total',
    help: 'Total number of blacklisted IP addresses'
  });

  // Business Metrics
  private static receiptsCreated = new Counter({
    name: 'receipts_created_total',
    help: 'Total number of receipts created',
    labelNames: ['user_id', 'category']
  });

  private static receiptsProcessed = new Counter({
    name: 'receipts_processed_total',
    help: 'Total number of receipts processed by OCR',
    labelNames: ['user_id', 'success']
  });

  private static aiInteractions = new Counter({
    name: 'ai_interactions_total',
    help: 'Total number of AI interactions',
    labelNames: ['user_id', 'interaction_type', 'model']
  });

  // System Metrics
  private static activeUsers = new Gauge({
    name: 'active_users_total',
    help: 'Total number of active users'
  });

  private static databaseConnections = new Gauge({
    name: 'database_connections_total',
    help: 'Total number of database connections'
  });

  private static memoryUsage = new Gauge({
    name: 'memory_usage_bytes',
    help: 'Memory usage in bytes',
    labelNames: ['type']
  });

  // Initialize metrics
  static initialize() {
    try {
      // Collect default Node.js metrics
      collectDefaultMetrics({ register });

      // Set up periodic metrics collection
      this.startPeriodicMetricsCollection();

      logger.info('Metrics service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize metrics service:', error);
    }
  }

  // Record HTTP request
  static recordHttpRequest(method: string, route: string, statusCode: number, duration: number) {
    try {
      this.httpRequestsTotal.inc({ method, route, status_code: statusCode.toString() });
      this.httpRequestDuration.observe({ method, route }, duration);
    } catch (error) {
      logger.error('Failed to record HTTP metrics:', error);
    }
  }

  // Record security event
  static recordSecurityEvent(eventType: string, severity: string, ipAddress: string) {
    try {
      this.securityEventsTotal.inc({ event_type: eventType, severity, ip_address: ipAddress });
    } catch (error) {
      logger.error('Failed to record security event:', error);
    }
  }

  // Record failed login attempt
  static recordFailedLogin(ipAddress: string, userAgent: string) {
    try {
      this.failedLoginAttempts.inc({ ip_address: ipAddress, user_agent: userAgent });
    } catch (error) {
      logger.error('Failed to record failed login:', error);
    }
  }

  // Record rate limit violation
  static recordRateLimitViolation(ipAddress: string, endpoint: string) {
    try {
      this.rateLimitExceeded.inc({ ip_address: ipAddress, endpoint });
    } catch (error) {
      logger.error('Failed to record rate limit violation:', error);
    }
  }

  // Update blacklisted IPs count
  static updateBlacklistedIPsCount(count: number) {
    try {
      this.blacklistedIPs.set(count);
    } catch (error) {
      logger.error('Failed to update blacklisted IPs count:', error);
    }
  }

  // Record receipt creation
  static recordReceiptCreated(userId: string, category: string) {
    try {
      this.receiptsCreated.inc({ user_id: userId, category });
    } catch (error) {
      logger.error('Failed to record receipt creation:', error);
    }
  }

  // Record receipt processing
  static recordReceiptProcessed(userId: string, success: boolean) {
    try {
      this.receiptsProcessed.inc({ user_id: userId, success: success.toString() });
    } catch (error) {
      logger.error('Failed to record receipt processing:', error);
    }
  }

  // Record AI interaction
  static recordAIInteraction(userId: string, interactionType: string, model: string) {
    try {
      this.aiInteractions.inc({ user_id: userId, interaction_type: interactionType, model });
    } catch (error) {
      logger.error('Failed to record AI interaction:', error);
    }
  }

  // Update active users count
  static updateActiveUsersCount(count: number) {
    try {
      this.activeUsers.set(count);
    } catch (error) {
      logger.error('Failed to update active users count:', error);
    }
  }

  // Update database connections count
  static updateDatabaseConnectionsCount(count: number) {
    try {
      this.databaseConnections.set(count);
    } catch (error) {
      logger.error('Failed to update database connections count:', error);
    }
  }

  // Update memory usage
  static updateMemoryUsage() {
    try {
      const memUsage = process.memoryUsage();
      this.memoryUsage.set({ type: 'rss' }, memUsage.rss);
      this.memoryUsage.set({ type: 'heap_used' }, memUsage.heapUsed);
      this.memoryUsage.set({ type: 'heap_total' }, memUsage.heapTotal);
      this.memoryUsage.set({ type: 'external' }, memUsage.external);
    } catch (error) {
      logger.error('Failed to update memory usage:', error);
    }
  }

  // Get metrics as string
  static async getMetrics(): Promise<string> {
    try {
      return await register.metrics();
    } catch (error) {
      logger.error('Failed to get metrics:', error);
      return '';
    }
  }

  // Start periodic metrics collection
  private static startPeriodicMetricsCollection() {
    // Update memory usage every 30 seconds
    setInterval(() => {
      this.updateMemoryUsage();
    }, 30000);

    // Update system metrics every minute
    setInterval(() => {
      // Update active users (this would be calculated from your user session data)
      // this.updateActiveUsersCount(activeUsersCount);
      
      // Update database connections (this would be from your database pool)
      // this.updateDatabaseConnectionsCount(dbConnectionsCount);
    }, 60000);
  }

  // Reset all metrics (useful for testing)
  static resetMetrics() {
    try {
      register.clear();
      this.initialize();
      logger.info('Metrics reset successfully');
    } catch (error) {
      logger.error('Failed to reset metrics:', error);
    }
  }

  // Get metrics summary for monitoring
  static getMetricsSummary() {
    try {
      return {
        httpRequests: this.httpRequestsTotal,
        httpDuration: this.httpRequestDuration,
        securityEvents: this.securityEventsTotal,
        failedLogins: this.failedLoginAttempts,
        rateLimitViolations: this.rateLimitExceeded,
        blacklistedIPs: this.blacklistedIPs,
        receiptsCreated: this.receiptsCreated,
        receiptsProcessed: this.receiptsProcessed,
        aiInteractions: this.aiInteractions,
        activeUsers: this.activeUsers,
        databaseConnections: this.databaseConnections,
        memoryUsage: this.memoryUsage
      };
    } catch (error) {
      logger.error('Failed to get metrics summary:', error);
      return {};
    }
  }
} 