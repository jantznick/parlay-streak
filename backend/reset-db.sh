#!/bin/bash
# WARNING: This will DELETE ALL DATA in your database
# Only run this in development!

set -e

echo "⚠️  WARNING: This will DELETE ALL DATA from your database!"
echo "Press Ctrl+C to cancel, or Enter to continue..."
read

echo "Dropping all tables..."
npx prisma migrate reset --force --skip-seed

echo "Cleaning up migrations directory..."
rm -rf prisma/migrations/*

echo "Creating fresh migration from current schema..."
npx prisma migrate dev --name init

echo "✅ Database reset complete!"

