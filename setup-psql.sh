#!/bin/bash

# PostgreSQL psql PATH Setup Script

echo "🔍 Finding PostgreSQL installation..."

# Check common locations
PSQL_PATH=""

if [ -f "/opt/homebrew/opt/postgresql@15/bin/psql" ]; then
    PSQL_PATH="/opt/homebrew/opt/postgresql@15/bin"
elif [ -f "/opt/homebrew/opt/postgresql/bin/psql" ]; then
    PSQL_PATH="/opt/homebrew/opt/postgresql/bin"
elif [ -f "/usr/local/bin/psql" ]; then
    PSQL_PATH="/usr/local/bin"
else
    echo "❌ PostgreSQL not found in common locations"
    echo "Please install PostgreSQL: brew install postgresql@15"
    exit 1
fi

echo "✅ Found PostgreSQL at: $PSQL_PATH"

# Add to PATH for current session
export PATH="$PSQL_PATH:$PATH"

echo ""
echo "📝 To use psql in this terminal session:"
echo "export PATH=\"$PSQL_PATH:\$PATH\""
echo ""
echo "📝 To make it permanent, add to ~/.zshrc:"
echo "echo 'export PATH=\"$PSQL_PATH:\$PATH\"' >> ~/.zshrc"
echo "source ~/.zshrc"
echo ""

# Test connection
echo "🧪 Testing connection..."
$PSQL_PATH/psql soluter -c "\dt" 2>/dev/null

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Connection successful!"
    echo ""
    echo "🚀 Now you can use:"
    echo "  psql soluter                    # Connect to database"
    echo "  psql soluter -c '\dt'           # List tables"
    echo "  psql soluter -c 'SELECT * FROM \"Document\";'  # Query data"
else
    echo ""
    echo "⚠️  Could not connect. Make sure PostgreSQL is running:"
    echo "  brew services start postgresql@15"
fi

