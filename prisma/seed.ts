/// <reference types="node" />

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Squirli database seeding...');

  // Create a test user
  const testUser = await prisma.user.upsert({
    where: { email: 'test@squirli.com' },
    update: {},
    create: {
              email: 'test@squirli.com',
      password: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/HS.iK8i', // "TestPassword123!"
      firstName: 'Test',
      lastName: 'User',
      phone: '+18095551234',
      dateOfBirth: new Date('1990-01-01'),
      financialLevel: 'BEGINNER',
      subscription: 'FREE',
      language: 'SPANISH',
      currency: 'DOP',
      emailVerified: true,
      lastLoginAt: new Date()
    }
  });

  console.log('✅ Test user created:', testUser.email);

  // Create user preferences
  await prisma.userPreference.upsert({
    where: { userId: testUser.id },
    update: {},
    create: {
      userId: testUser.id,
      theme: 'LIGHT',
      pushNotifications: true,
      emailNotifications: true,
      smsNotifications: false,
      weeklyReports: true,
      monthlyReports: true,
      aiRecommendations: true,
      locationServices: false
    }
  });

  console.log('✅ User preferences created');

  // Create sample receipts
  const sampleReceipts = await Promise.all([
    prisma.receipt.create({
      data: {
        userId: testUser.id,
        merchantName: 'Downtown Restaurant',
        amount: 45.50,
        currency: 'DOP',
        transactionDate: new Date(),
        category: 'FOOD_AND_DRINKS',
        subcategory: 'Restaurant',
        paymentMethod: 'CREDIT_CARD',
        location: 'Downtown',
        notes: 'Lunch with colleagues'
      }
    }),
    prisma.receipt.create({
      data: {
        userId: testUser.id,
        merchantName: 'Gas Station',
        amount: 120.00,
        currency: 'DOP',
        transactionDate: new Date(Date.now() - 86400000), // Yesterday
        category: 'TRANSPORTATION',
        subcategory: 'Fuel',
        paymentMethod: 'DEBIT_CARD',
        location: 'Highway',
        notes: 'Gas for car'
      }
    }),
    prisma.receipt.create({
      data: {
        userId: testUser.id,
        merchantName: 'Cinema',
        amount: 89.99,
        currency: 'DOP',
        transactionDate: new Date(Date.now() - 172800000), // 2 days ago
        category: 'ENTERTAINMENT',
        subcategory: 'Movies',
        paymentMethod: 'CASH',
        location: 'Mall',
        notes: 'Movie tickets'
      }
    })
  ]);

  console.log('✅ Sample receipts created:', sampleReceipts.length);

  // Create sample financial tests
  const sampleTests = await Promise.all([
    prisma.financialTest.create({
      data: {
        userId: testUser.id,
        testVersion: 'v1.0',
        questions: {
          questions: [
            { id: 1, question: 'What is compound interest?', type: 'multiple_choice' },
            { id: 2, question: 'How much should you save for emergencies?', type: 'multiple_choice' }
          ]
        },
        score: 75,
        level: 'BEGINNER',
        recommendations: {
          recommendations: [
            'Start with a $1,000 emergency fund',
            'Learn about compound interest',
            'Create a budget'
          ]
        }
      }
    }),
    prisma.financialTest.create({
      data: {
        userId: testUser.id,
        testVersion: 'v1.0',
        questions: {
          questions: [
            { id: 1, question: 'What is your risk tolerance?', type: 'multiple_choice' },
            { id: 2, question: 'How do you react to market volatility?', type: 'multiple_choice' }
          ]
        },
        score: 60,
        level: 'INTERMEDIATE',
        recommendations: {
          recommendations: [
            'Consider diversified investments',
            'Learn about different asset classes',
            'Review your risk tolerance regularly'
          ]
        }
      }
    })
  ]);

  console.log('✅ Sample financial tests created:', sampleTests.length);

  console.log('🎉 Squirli database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 