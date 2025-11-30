#!/bin/bash

# Fix Vector Type - Database Reset Script

echo "🔧 Fixing Vector Type in Database..."
echo ""
echo "⚠️  WARNING: This will DELETE ALL DATA in the database!"
echo "   Press Ctrl+C to cancel, or Enter to continue..."
read

cd "$(dirname "$0")"

echo ""
echo "📋 Step 1: Resetting database..."
npx prisma migrate reset --force --skip-seed

if [ $? -eq 0 ]; then
    echo "✅ Database reset successful!"
else
    echo "❌ Database reset failed!"
    exit 1
fi

echo ""
echo "📋 Step 2: Applying migration with vector type..."
npx prisma migrate dev --name fix_vector_type

if [ $? -eq 0 ]; then
    echo "✅ Migration applied successfully!"
else
    echo "❌ Migration failed!"
    exit 1
fi

echo ""
echo "📋 Step 3: Generating Prisma Client..."
npx prisma generate

if [ $? -eq 0 ]; then
    echo "✅ Prisma Client generated!"
else
    echo "❌ Prisma Client generation failed!"
    exit 1
fi

echo ""
echo "🎉 Vector type fix complete!"
echo ""
echo "📝 Next steps:"
echo "   1. Verify: psql soluter -c '\\d \"Chunk\"'"
echo "   2. Update code to use raw SQL for vector operations"
echo "   3. See FIX_VECTOR_TYPE.md for details"

