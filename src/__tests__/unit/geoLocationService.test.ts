import { PrismaClient } from '@prisma/client';
import { GeoLocationService, GeoLocation, LocationAnomaly } from '../../services/geoLocationService';

// Mock axios
jest.mock('axios');
const mockAxios = require('axios');

// Mock Prisma
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    auditLog: {
      findMany: jest.fn()
    }
  }))
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

describe('GeoLocationService', () => {
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = new PrismaClient();
    GeoLocationService.setPrisma(mockPrisma);
    mockAxios.get.mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
    GeoLocationService.resetPrisma();
    GeoLocationService.clearCache();
  });

  describe('getLocation', () => {
    it('should return location for valid IP', async () => {
      const mockResponse = {
        data: {
          status: 'success',
          country: 'United States',
          countryCode: 'US',
          regionName: 'California',
          region: 'CA',
          city: 'San Francisco',
          zip: '94105',
          lat: 37.7749,
          lon: -122.4194,
          timezone: 'America/Los_Angeles',
          isp: 'Cloudflare, Inc.',
          org: 'Cloudflare, Inc.',
          as: 'AS13335 Cloudflare, Inc.',
          proxy: false,
          hosting: false
        }
      };

      mockAxios.get.mockResolvedValue(mockResponse);

      const result = await GeoLocationService.getLocation('8.8.8.8');

      expect(result).toEqual({
        ip: '8.8.8.8',
        country: 'United States',
        countryCode: 'US',
        region: 'California',
        regionCode: 'CA',
        city: 'San Francisco',
        zip: '94105',
        latitude: 37.7749,
        longitude: -122.4194,
        timezone: 'America/Los_Angeles',
        isp: 'Cloudflare, Inc.',
        org: 'Cloudflare, Inc.',
        as: 'AS13335 Cloudflare, Inc.',
        proxy: false,
        hosting: false,
        vpn: false,
        tor: false
      });
    });

    it('should return local location for local IP', async () => {
      const result = await GeoLocationService.getLocation('127.0.0.1');

      expect(result).toEqual({
        ip: '127.0.0.1',
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
      });
    });

    it('should return null for failed API response', async () => {
      const mockResponse = {
        data: {
          status: 'fail',
          message: 'Invalid IP address'
        }
      };

      mockAxios.get.mockResolvedValue(mockResponse);

      const result = await GeoLocationService.getLocation('invalid-ip');

      expect(result).toBeNull();
    });

    it('should cache results', async () => {
      const mockResponse = {
        data: {
          status: 'success',
          country: 'Canada',
          countryCode: 'CA',
          regionName: 'Ontario',
          region: 'ON',
          city: 'Toronto',
          zip: 'M5V',
          lat: 43.6532,
          lon: -79.3832,
          timezone: 'America/Toronto',
          isp: 'Rogers Communications',
          org: 'Rogers Communications',
          as: 'AS812 Rogers Communications',
          proxy: false,
          hosting: false
        }
      };

      mockAxios.get.mockResolvedValue(mockResponse);

      // First call
      const result1 = await GeoLocationService.getLocation('1.1.1.1');
      // Second call (should use cache)
      const result2 = await GeoLocationService.getLocation('1.1.1.1');

      expect(result1).toEqual(result2);
      expect(mockAxios.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('detectAnomalies', () => {
    it('should detect country change anomaly', async () => {
      const mockLocation: GeoLocation = {
        ip: '8.8.8.8',
        country: 'United States',
        countryCode: 'US',
        region: 'California',
        regionCode: 'CA',
        city: 'San Francisco',
        zip: '94105',
        latitude: 37.7749,
        longitude: -122.4194,
        timezone: 'America/Los_Angeles',
        isp: 'Cloudflare, Inc.',
        org: 'Cloudflare, Inc.',
        as: 'AS13335 Cloudflare, Inc.',
        proxy: false,
        hosting: false,
        vpn: false,
        tor: false
      };

      const previousLocation: GeoLocation = {
        ip: '1.1.1.1',
        country: 'Canada',
        countryCode: 'CA',
        region: 'Ontario',
        regionCode: 'ON',
        city: 'Toronto',
        zip: 'M5V',
        latitude: 43.6532,
        longitude: -79.3832,
        timezone: 'America/Toronto',
        isp: 'Rogers Communications',
        org: 'Rogers Communications',
        as: 'AS812 Rogers Communications',
        proxy: false,
        hosting: false,
        vpn: false,
        tor: false
      };

      // Mock getLocation to return different locations
      jest.spyOn(GeoLocationService, 'getLocation')
        .mockResolvedValueOnce(mockLocation) // Current location
        .mockResolvedValueOnce(previousLocation); // Previous location

      mockPrisma.auditLog.findMany.mockResolvedValue([
        { ipAddress: '1.1.1.1' }
      ]);

      const anomalies = await GeoLocationService.detectAnomalies('user-123', '8.8.8.8');

      expect(anomalies.length).toBeGreaterThan(0);
      const countryChangeAnomaly = anomalies.find(a => a.type === 'COUNTRY_CHANGE');
      expect(countryChangeAnomaly).toBeDefined();
      expect(countryChangeAnomaly?.severity).toBe('HIGH');
      expect(countryChangeAnomaly?.description).toContain('United States');
    });

    it('should detect proxy/VPN anomaly', async () => {
      const mockLocation: GeoLocation = {
        ip: '8.8.8.8',
        country: 'United States',
        countryCode: 'US',
        region: 'California',
        regionCode: 'CA',
        city: 'San Francisco',
        zip: '94105',
        latitude: 37.7749,
        longitude: -122.4194,
        timezone: 'America/Los_Angeles',
        isp: 'Cloudflare, Inc.',
        org: 'Cloudflare, Inc.',
        as: 'AS13335 Cloudflare, Inc.',
        proxy: true,
        hosting: false,
        vpn: true,
        tor: false
      };

      const getLocationSpy = jest.spyOn(GeoLocationService, 'getLocation').mockResolvedValue(mockLocation);

      // Mock previous logins to trigger anomaly detection
      mockPrisma.auditLog.findMany.mockResolvedValue([
        { ipAddress: '1.1.1.1' }
      ]);

      const anomalies = await GeoLocationService.detectAnomalies('user-123', '8.8.8.8');

      expect(anomalies.length).toBeGreaterThan(0);
      const proxyAnomaly = anomalies.find(a => a.type === 'SUSPICIOUS_PROXY');
      expect(proxyAnomaly).toBeDefined();
      expect(proxyAnomaly?.severity).toBe('MEDIUM');
    });

    it('should detect high-risk country anomaly', async () => {
      const mockLocation: GeoLocation = {
        ip: '8.8.8.8',
        country: 'North Korea',
        countryCode: 'KP',
        region: 'Pyongyang',
        regionCode: 'PY',
        city: 'Pyongyang',
        zip: '',
        latitude: 39.0194,
        longitude: 125.7381,
        timezone: 'Asia/Pyongyang',
        isp: 'Korea Post and Telecommunications Corporation',
        org: 'Korea Post and Telecommunications Corporation',
        as: 'AS131279 Korea Post and Telecommunications Corporation',
        proxy: false,
        hosting: false,
        vpn: false,
        tor: false
      };

      jest.spyOn(GeoLocationService, 'getLocation').mockResolvedValue(mockLocation);

      // Mock previous logins to trigger anomaly detection
      mockPrisma.auditLog.findMany.mockResolvedValue([
        { ipAddress: '1.1.1.1' }
      ]);

      const anomalies = await GeoLocationService.detectAnomalies('user-123', '8.8.8.8');

      expect(anomalies.length).toBeGreaterThan(0);
      const highRiskAnomaly = anomalies.find(a => a.type === 'HIGH_RISK_COUNTRY');
      expect(highRiskAnomaly).toBeDefined();
      expect(highRiskAnomaly?.severity).toBe('CRITICAL');
    });

    it('should return empty array for first login', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);

      const anomalies = await GeoLocationService.detectAnomalies('user-123', '8.8.8.8');

      expect(anomalies).toHaveLength(0);
    });
  });

  describe('calculateDistance', () => {
    it('should calculate distance between two points', () => {
      const lat1 = 37.7749; // San Francisco
      const lon1 = -122.4194;
      const lat2 = 40.7128; // New York
      const lon2 = -74.0060;

      const distance = GeoLocationService.calculateDistance(lat1, lon1, lat2, lon2);

      expect(distance).toBeGreaterThan(4000); // Should be around 4100+ km
      expect(distance).toBeLessThan(4200);
    });

    it('should return 0 for same coordinates', () => {
      const lat = 37.7749;
      const lon = -122.4194;

      const distance = GeoLocationService.calculateDistance(lat, lon, lat, lon);

      expect(distance).toBe(0);
    });
  });

  describe('getUserLocationStats', () => {
    it('should return location statistics', async () => {
      const mockLogins = [
        { ipAddress: '8.8.8.8' },
        { ipAddress: '1.1.1.1' },
        { ipAddress: '8.8.8.8' } // Duplicate IP
      ];

      const mockLocation: GeoLocation = {
        ip: '8.8.8.8',
        country: 'United States',
        countryCode: 'US',
        region: 'California',
        regionCode: 'CA',
        city: 'San Francisco',
        zip: '94105',
        latitude: 37.7749,
        longitude: -122.4194,
        timezone: 'America/Los_Angeles',
        isp: 'Cloudflare, Inc.',
        org: 'Cloudflare, Inc.',
        as: 'AS13335 Cloudflare, Inc.',
        proxy: false,
        hosting: false,
        vpn: false,
        tor: false
      };

      mockPrisma.auditLog.findMany.mockResolvedValue(mockLogins);
      jest.spyOn(GeoLocationService, 'getLocation').mockResolvedValue(mockLocation);

      const stats = await GeoLocationService.getUserLocationStats('user-123');

      expect(stats.totalLogins).toBe(3);
      expect(stats.uniqueCountries).toBe(1);
      expect(stats.uniqueCities).toBe(1);
      expect(stats.mostFrequentCountry).toBe('US');
      expect(stats.mostFrequentCity).toBe('San Francisco');
    });

    it('should return default stats for no logins', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);

      const stats = await GeoLocationService.getUserLocationStats('user-123');

      expect(stats.totalLogins).toBe(0);
      expect(stats.uniqueCountries).toBe(0);
      expect(stats.uniqueCities).toBe(0);
      expect(stats.mostFrequentCountry).toBe('Unknown');
      expect(stats.mostFrequentCity).toBe('Unknown');
    });
  });

  describe('cache management', () => {
    it('should clear cache', () => {
      GeoLocationService.clearCache();
      const stats = GeoLocationService.getCacheStats();
      expect(stats.size).toBe(0);
    });

    it('should get cache statistics', () => {
      const stats = GeoLocationService.getCacheStats();
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('entries');
      expect(Array.isArray(stats.entries)).toBe(true);
    });
  });
}); 