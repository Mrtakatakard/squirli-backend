# 🐿️ SQUIRLI - Your AI Money Assistant

![Squirli Banner](https://via.placeholder.com/800x200/FF6B35/FFFFFF?text=🐿️+SQUIRLI+-+Your+AI+Money+Assistant)

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/Squirli/squirli)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node.js-18+-green.svg)](https://nodejs.org/)
[![React Native](https://img.shields.io/badge/react--native-0.72+-blue.svg)](https://reactnative.dev/)

## 🎯 What is Squirli?

Squirli is your intelligent financial companion powered by Anthropic's Claude AI. Unlike traditional finance apps that just track expenses, Squirli **learns your financial level** and provides **personalized, adaptive guidance** that grows with you.

### 🌟 Key Features

- **🤖 AI-Powered Insights**: Claude AI analyzes your spending patterns and provides personalized financial advice
- **📊 Smart Expense Tracking**: Automatic categorization and intelligent receipt scanning
- **🎯 Personalized Goals**: AI-driven goal setting and progress tracking
- **💰 Investment Guidance**: Get investment recommendations based on your risk profile
- **🔒 Security First**: Bank-level security with end-to-end encryption
- **📱 Cross-Platform**: Works seamlessly on iOS and Android
- **🌍 Multi-Language**: Support for Spanish, English, and French

### 🏗️ Architecture

```
squirli/
├── backend/           # Node.js + Express + Prisma + Claude AI
├── mobile/           # React Native + Expo
├── database/         # PostgreSQL migrations and seeds
├── monitoring/       # Prometheus + Grafana
├── docs/            # Documentation and strategies
└── scripts/         # Setup and deployment scripts
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm 9+
- Docker and Docker Compose
- PostgreSQL (or use Docker)
- Claude API Key from Anthropic

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/Squirli/squirli.git
cd squirli
```

2. **Set up environment variables**
```bash
cp env.example .env
# Edit .env with your configuration
```

3. **Install dependencies**
```bash
npm install
```

4. **Start the database**
```bash
npm run docker:up
```

5. **Run database migrations**
```bash
npm run db:migrate
npm run db:seed
```

6. **Start development servers**
```bash
npm run dev
```

### 🐳 Docker Setup

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## 📱 Mobile App

The mobile app is built with React Native and Expo, providing a native experience across iOS and Android.

### Features
- **Intuitive UI**: Clean, modern interface designed for financial management
- **Offline Support**: Works without internet connection
- **Push Notifications**: Smart reminders and alerts
- **Biometric Auth**: Secure login with fingerprint/face ID
- **Dark Mode**: Beautiful dark theme support

### Development
```bash
cd mobile
npm install
npm run dev
```

## 🔧 Backend API

The backend is built with Node.js, Express, and Prisma, featuring Claude AI integration for intelligent financial analysis.

### Key Endpoints
- `POST /api/v1/claude/chat` - AI-powered financial advice
- `GET /api/v1/users/profile` - User profile management
- `POST /api/v1/receipts/upload` - Receipt processing
- `GET /api/v1/analytics/insights` - Financial insights

### Development
```bash
cd backend
npm install
npm run dev
```

## 🗄️ Database

PostgreSQL with Prisma ORM for type-safe database operations.

### Schema Highlights
- **Users**: Profile and preferences
- **AI Interactions**: Claude AI conversation history
- **Receipts**: Expense tracking with OCR
- **Financial Tests**: User financial literacy assessment

### Database Operations
```bash
# Run migrations
npm run db:migrate

# Seed database
npm run db:seed

# Reset database
npm run db:reset
```

## 📊 Monitoring

Prometheus and Grafana for comprehensive monitoring and analytics.

### Metrics Tracked
- API response times
- Database performance
- AI interaction success rates
- User engagement metrics

### Access
- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3001 (admin/admin)

## 🧪 Testing

```bash
# Run all tests
npm test

# Backend tests only
npm run test:backend

# Mobile tests only
npm run test:mobile
```

## 📚 Documentation

- [API Documentation](docs/api/)
- [Architecture Guide](docs/architecture/)
- [Development Guide](docs/development/)
- [Deployment Guide](docs/deployment/)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📋 Roadmap

### Phase 1: Core Features ✅
- [x] User authentication and profiles
- [x] Basic expense tracking
- [x] Claude AI integration
- [x] Receipt scanning
- [x] Financial insights

### Phase 2: Advanced Features 🚧
- [ ] Investment portfolio tracking
- [ ] Budget automation
- [ ] Bill reminders
- [ ] Financial goal planning
- [ ] AI avatar (3D Squirli)

### Phase 3: Enterprise Features 📋
- [ ] Team/family accounts
- [ ] Business expense tracking
- [ ] Advanced analytics
- [ ] API for third-party integrations
- [ ] White-label solutions

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Website**: [squirli.com](https://squirli.com)
- **Email**: hello@squirli.com
- **Issues**: [GitHub Issues](https://github.com/Squirli/squirli/issues)
- **Documentation**: [docs.squirli.com](https://docs.squirli.com)

## 🙏 Acknowledgments

- **Anthropic** for Claude AI
- **Expo** for React Native development
- **Prisma** for database ORM
- **PostgreSQL** for reliable data storage

---

**Made with ❤️ by the Squirli Team**

[![Follow us](https://img.shields.io/twitter/follow/squirli?style=social)](https://twitter.com/squirli)
[![Star us](https://img.shields.io/github/stars/Squirli/squirli?style=social)](https://github.com/Squirli/squirli) 