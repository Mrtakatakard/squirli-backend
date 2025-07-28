import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger';
import { AuditService } from './auditService';

// Default Prisma instance for production use
const defaultPrisma = new PrismaClient();

export interface GeoLocation {
  ip: string;
  country: string;
  countryCode: string;
  region: string;
  regionCode: string;
  city: string;
  zip: string;
  latitude: number;
  longitude: number;
  timezone: string;
  isp: string;
  org: string;
  as: string;
  proxy: boolean;
  hosting: boolean;
  vpn: boolean;
  tor: boolean;
}

export interface LocationAnomaly {
  type: 'COUNTRY_CHANGE' | 'REGION_CHANGE' | 'CITY_CHANGE' | 'SUSPICIOUS_PROXY' | 'UNUSUAL_TIME' | 'HIGH_RISK_COUNTRY';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  details: {
    currentLocation: Partial<GeoLocation>;
    previousLocation?: Partial<GeoLocation>;
    riskScore: number;
    [key: string]: any;
  };
}

export class GeoLocationService {
  private static prisma: PrismaClient = defaultPrisma;
  private static cache = new Map<string, { data: GeoLocation; timestamp: number }>();
  private static readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
  private static readonly HIGH_RISK_COUNTRIES = [
    'KP', // North Korea
    'IR', // Iran
    'SY', // Syria
    'CU', // Cuba
    'RU'  // Russia (for some use cases)
  ];

  // Method to set Prisma instance for testing
  static setPrisma(prismaInstance: PrismaClient) {
    GeoLocationService.prisma = prismaInstance;
  }

  // Method to reset to default Prisma instance
  static resetPrisma() {
    GeoLocationService.prisma = defaultPrisma;
  }

  // Get geolocation for IP address
  static async getLocation(ipAddress: string): Promise<GeoLocation | null> {
    try {
      // Check cache first
      const cached = this.cache.get(ipAddress);
      if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
        return cached.data;
      }

      // Skip local IPs
      if (this.isLocalIP(ipAddress)) {
        return this.getLocalLocation(ipAddress);
      }

      // Use ipapi.co for geolocation (free tier available)
      const response = await axios.get(`http://ip-api.com/json/${ipAddress}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,proxy,hosting,mobile,query`, {
        timeout: 5000
      });

      if (response.data.status === 'success') {
        const data = response.data;
        const location: GeoLocation = {
          ip: ipAddress,
          country: data.country || 'Unknown',
          countryCode: data.countryCode || 'XX',
          region: data.regionName || 'Unknown',
          regionCode: data.region || 'XX',
          city: data.city || 'Unknown',
          zip: data.zip || '',
          latitude: data.lat || 0,
          longitude: data.lon || 0,
          timezone: data.timezone || 'UTC',
          isp: data.isp || 'Unknown',
          org: data.org || 'Unknown',
          as: data.as || 'Unknown',
          proxy: data.proxy || false,
          hosting: data.hosting || false,
          vpn: data.proxy || false, // Assume proxy = VPN for now
          tor: false // Would need additional service to detect Tor
        };

        // Cache the result
        this.cache.set(ipAddress, { data: location, timestamp: Date.now() });

        return location;
      }

      logger.warn(`Failed to get location for IP ${ipAddress}: ${response.data.message}`);
      return null;
    } catch (error) {
      logger.error(`Error getting location for IP ${ipAddress}:`, error);
      return null;
    }
  }

  // Check for location anomalies
  static async detectAnomalies(userId: string, currentIP: string): Promise<LocationAnomaly[]> {
    try {
      const anomalies: LocationAnomaly[] = [];
      const currentLocation = await this.getLocation(currentIP);
      
      if (!currentLocation) {
        return anomalies;
      }

      // Get user's previous login locations
      const previousLogins = await this.prisma.auditLog.findMany({
        where: {
          userId,
          action: 'LOGIN',
          success: true,
          ipAddress: { not: null }
        },
        orderBy: { timestamp: 'desc' },
        take: 5,
        distinct: ['ipAddress']
      });

      if (previousLogins.length === 0) {
        // First login, no anomalies
        return anomalies;
      }

      // Check for country changes
      const previousCountries = new Set(previousLogins.map(login => login.ipAddress).filter(Boolean));
      const previousLocations = await Promise.all(
        Array.from(previousCountries).map(ip => this.getLocation(ip!))
      );

      const previousCountry = previousLocations[0]?.countryCode;
      if (previousCountry && previousCountry !== currentLocation.countryCode) {
        anomalies.push({
          type: 'COUNTRY_CHANGE',
          severity: 'HIGH',
          description: `Login from different country: ${currentLocation.country} (${currentLocation.countryCode})`,
          details: {
            currentLocation,
            previousLocation: previousLocations[0],
            riskScore: 0.8
          }
        });
      }

      // Check for region changes
      const previousRegion = previousLocations[0]?.regionCode;
      if (previousRegion && previousRegion !== currentLocation.regionCode) {
        anomalies.push({
          type: 'REGION_CHANGE',
          severity: 'MEDIUM',
          description: `Login from different region: ${currentLocation.region}`,
          details: {
            currentLocation,
            previousLocation: previousLocations[0],
            riskScore: 0.6
          }
        });
      }

      // Check for suspicious proxy/VPN usage
      if (currentLocation.proxy || currentLocation.vpn) {
        anomalies.push({
          type: 'SUSPICIOUS_PROXY',
          severity: 'MEDIUM',
          description: `Login from proxy/VPN detected`,
          details: {
            currentLocation,
            riskScore: 0.7
          }
        });
      }

      // Check for high-risk countries
      if (this.HIGH_RISK_COUNTRIES.includes(currentLocation.countryCode)) {
        anomalies.push({
          type: 'HIGH_RISK_COUNTRY',
          severity: 'CRITICAL',
          description: `Login from high-risk country: ${currentLocation.country}`,
          details: {
            currentLocation,
            riskScore: 0.9
          }
        });
      }

      // Check for unusual login times (simplified)
      const userTimezone = currentLocation.timezone;
      const currentHour = new Date().getHours();
      if (currentHour < 6 || currentHour > 23) {
        anomalies.push({
          type: 'UNUSUAL_TIME',
          severity: 'LOW',
          description: `Login at unusual hour: ${currentHour}:00`,
          details: {
            currentLocation,
            riskScore: 0.3
          }
        });
      }

      return anomalies;
    } catch (error) {
      logger.error('Error detecting location anomalies:', error);
      return [];
    }
  }

  // Calculate distance between two locations
  static calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  // Convert degrees to radians
  private static deg2rad(deg: number): number {
    return deg * (Math.PI/180);
  }

  // Check if IP is local
  private static isLocalIP(ip: string): boolean {
    const localRanges = [
      /^127\./, // localhost
      /^10\./, // private network
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // private network
      /^192\.168\./, // private network
      /^169\.254\./, // link-local
      /^::1$/, // IPv6 localhost
      /^fe80:/, // IPv6 link-local
    ];

    return localRanges.some(range => range.test(ip));
  }

  // Get local location info
  private static getLocalLocation(ip: string): GeoLocation {
    return {
      ip,
      country: 'Local',
      countryCode: 'LOCAL',
      region: 'Local Network',
      regionCode: 'LOCAL',
      city: 'Local',
      zip: '',
      latitude: 0,
      longitude: 0,
      timezone: 'UTC',
      isp: 'Local Network',
      org: 'Local Network',
      as: 'Local',
      proxy: false,
      hosting: false,
      vpn: false,
      tor: false
    };
  }

  // Get location statistics for user
  static async getUserLocationStats(userId: string): Promise<{
    totalLogins: number;
    uniqueCountries: number;
    uniqueCities: number;
    mostFrequentCountry: string;
    mostFrequentCity: string;
    lastLoginLocation: GeoLocation | null;
    anomaliesDetected: number;
  }> {
    try {
      const logins = await this.prisma.auditLog.findMany({
        where: {
          userId,
          action: 'LOGIN',
          success: true,
          ipAddress: { not: null }
        },
        orderBy: { timestamp: 'desc' }
      });

      if (logins.length === 0) {
        return {
          totalLogins: 0,
          uniqueCountries: 0,
          uniqueCities: 0,
          mostFrequentCountry: 'Unknown',
          mostFrequentCity: 'Unknown',
          lastLoginLocation: null,
          anomaliesDetected: 0
        };
      }

      const locations = await Promise.all(
        logins.map(login => this.getLocation(login.ipAddress!))
      );

      const validLocations = locations.filter(loc => loc !== null) as GeoLocation[];
      const countries = validLocations.map(loc => loc.countryCode);
      const cities = validLocations.map(loc => loc.city);

      const countryCounts = countries.reduce((acc, country) => {
        acc[country] = (acc[country] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const cityCounts = cities.reduce((acc, city) => {
        acc[city] = (acc[city] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const mostFrequentCountry = Object.entries(countryCounts)
        .sort(([,a], [,b]) => b - a)[0]?.[0] || 'Unknown';

      const mostFrequentCity = Object.entries(cityCounts)
        .sort(([,a], [,b]) => b - a)[0]?.[0] || 'Unknown';

      return {
        totalLogins: logins.length,
        uniqueCountries: new Set(countries).size,
        uniqueCities: new Set(cities).size,
        mostFrequentCountry,
        mostFrequentCity,
        lastLoginLocation: validLocations[0] || null,
        anomaliesDetected: 0 // Would need to track this separately
      };
    } catch (error) {
      logger.error('Error getting user location stats:', error);
      return {
        totalLogins: 0,
        uniqueCountries: 0,
        uniqueCities: 0,
        mostFrequentCountry: 'Unknown',
        mostFrequentCity: 'Unknown',
        lastLoginLocation: null,
        anomaliesDetected: 0
      };
    }
  }

  // Log location anomaly
  static async logLocationAnomaly(userId: string, anomaly: LocationAnomaly): Promise<void> {
    try {
      await AuditService.logSecurityEvent({
        userId,
        action: 'SUSPICIOUS_ACTIVITY',
        severity: anomaly.severity,
        details: {
          anomalyType: anomaly.type,
          description: anomaly.description,
          location: anomaly.details.currentLocation,
          riskScore: anomaly.details.riskScore
        }
      });
    } catch (error) {
      logger.error('Error logging location anomaly:', error);
    }
  }

  // Clear cache
  static clearCache(): void {
    this.cache.clear();
  }

  // Get cache statistics
  static getCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys())
    };
  }
} 