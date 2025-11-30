#!/bin/bash

# PostgreSQL Database Setup Script for Soluter Backend

echo "Setting up PostgreSQL database for Soluter..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo -e "${RED} PostgreSQL is not installed!${NC}"
    echo "Please install PostgreSQL first:"
    echo "  macOS: brew install postgresql@15"
    echo "  Ubuntu: sudo apt-get install postgresql"
    exit 1
fi

echo -e "${GREEN} PostgreSQL is installed${NC}"

# Check if database exists, if not create it
echo " Creating database 'soluter'..."
createdb soluter 2>/dev/null
if [ $? -eq 0 ]; then
    echo -e "${GREEN} Database 'soluter' created${NC}"
else
    echo -e "${YELLOW}  Database 'soluter' might already exist${NC}"
fi

# Enable pgvector extension
echo " Enabling pgvector extension..."
psql soluter -c "CREATE EXTENSION IF NOT EXISTS vector;" 2>/dev/null
if [ $? -eq 0 ]; then
    echo -e "${GREEN} pgvector extension enabled${NC}"
else
    echo -e "${YELLOW}  Could not enable pgvector. Make sure it's installed:${NC}"
    echo "  macOS: brew install pgvector"
    echo "  Ubuntu: sudo apt-get install postgresql-15-pgvector"
fi

# Check .env file
if [ ! -f .env ]; then
    echo -e "${YELLOW} .env file not found. Creating template...${NC}"
    cat > .env << EOF
# Database
DATABASE_URL="postgresql://postgres@localhost:5432/soluter?schema=public"

# Server
PORT=3000
NODE_ENV=development

# Ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama2
OLLAMA_EMBEDDING_MODEL=nomic-embed

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_DIR=./src/uploads
EOF
    echo -e "${GREEN} .env file created. Please update DATABASE_URL with your password if needed.${NC}"
else
    echo -e "${GREEN} .env file exists${NC}"
fi

# Generate Prisma Client
echo " Generating Prisma Client..."
npx prisma generate
if [ $? -eq 0 ]; then
    echo -e "${GREEN} Prisma Client generated${NC}"
else
    echo -e "${RED} Failed to generate Prisma Client${NC}"
    exit 1
fi

# Run migrations
echo " Running database migrations..."
npx prisma migrate dev --name init
if [ $? -eq 0 ]; then
    echo -e "${GREEN} Database migrations completed${NC}"
    echo -e "${GREEN} Tables created: Document, Chunk, Relationship${NC}"
else
    echo -e "${RED} Migration failed. Check your DATABASE_URL in .env${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN} Database setup complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Update .env file with your PostgreSQL password if needed"
echo "  2. Start your server: npm run dev"
echo "  3. View database: npx prisma studio"

