#!/bin/bash

# CybLight Login - Setup Script

echo "📱 CybLight Login - Project Setup"
echo "=================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js не установлен. Пожалуйста, установите Node.js 16+ с https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js найден: $(node --version)"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm не установлен"
    exit 1
fi

echo "✅ npm найден: $(npm --version)"
echo ""

# Install dependencies
echo "📦 Установка зависимостей..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Ошибка при установке зависимостей"
    exit 1
fi

echo ""
echo "=================================="
echo "✅ Установка завершена!"
echo ""
echo "🚀 Начните разработку:"
echo "   npm run dev"
echo ""
echo "📦 Собрать для продакшена:"
echo "   npm run build"
echo ""
echo "✔️ Проверить типы:"
echo "   npm run type-check"
echo ""
echo "🔍 Линтинг:"
echo "   npm run lint"
echo ""
