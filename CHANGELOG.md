# 📋 Qashly Backend - Changelog

All notable changes to the Qashly backend will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2025-07-24

### 🚀 Added
- **Token Rotation Security**: Implemented automatic refresh token rotation for enhanced security
- **Postman Collection**: Created comprehensive API testing collection with automatic token management
- **Reduced Logging**: Optimized server logging to show only errors and warnings
- **Environment Configuration**: Updated token expiration times (1h access, 1d refresh)

### 🔧 Changed
- **JWT Configuration**: 
  - Access Token: 30min → 1 hour
  - Refresh Token: 7 days → 1 day
- **Logging Level**: Changed from 'debug' to 'info' for cleaner output
- **Morgan Middleware**: Now only logs errors (400+) and warnings

### 🐛 Fixed
- **TypeScript Errors**: Fixed unused parameter warnings in server configuration
- **Postman Scripts**: Corrected token extraction from API responses
- **JSON Format**: Fixed malformed JSON in Postman collection

### 🔒 Security
- **Token Rotation**: Each refresh generates new tokens, invalidating previous ones
- **Session Management**: Enhanced device tracking and multi-device logout
- **Input Validation**: Comprehensive email, phone, and password validation

## [0.2.0] - 2025-07-24

### 🚀 Added
- **Complete Authentication System**: Full JWT-based authentication with refresh tokens
- **Database Migrations**: Prisma ORM with PostgreSQL and Redis integration
- **Testing Suite**: Comprehensive Jest testing with pre-commit hooks
- **Professional Logging**: Winston-based logging system
- **API Documentation**: Swagger/OpenAPI integration ready
- **Security Middleware**: Helmet, CORS, rate limiting preparation

### 🔧 Changed
- **Project Structure**: Organized monorepo with clear separation of concerns
- **Development Workflow**: Added pre-commit hooks for code quality
- **Error Handling**: Comprehensive error management system

### 🐛 Fixed
- **TypeScript Configuration**: Resolved Jest type recognition issues
- **Database Schema**: Resolved Prisma migration conflicts

## [0.1.0] - 2025-07-24

### 🚀 Added
- **Project Foundation**: Initial project setup with TypeScript
- **Backend Architecture**: Express.js server with modular route system
- **Database Setup**: PostgreSQL and Redis configuration
- **Development Environment**: Docker Compose for local development
- **Basic API Structure**: Health check and API info endpoints

---

## 📝 Changelog Guidelines

### Version Format
- **Major.Minor.Patch** (e.g., 1.2.3)
- **Major**: Breaking changes
- **Minor**: New features, backward compatible
- **Patch**: Bug fixes, backward compatible

### Change Categories
- **🚀 Added**: New features
- **🔧 Changed**: Changes in existing functionality
- **🐛 Fixed**: Bug fixes
- **🔒 Security**: Security improvements
- **📚 Documentation**: Documentation updates
- **🧪 Testing**: Test additions or improvements
- **⚡ Performance**: Performance improvements
- **♻️ Refactored**: Code refactoring

---

## 🔗 Related Links

- [Backend Documentation](./docs/backend/README.md)
- [API Documentation](./docs/api/README.md)
- [Database Schema](./prisma/schema.prisma)
- [Testing Guide](./docs/testing/README.md)

---

**Backend Version**: 0.3.0  
**Last Updated**: July 24, 2025  
**Maintainer**: Qashly Team 