#!/bin/bash
set -e

echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] Iniciando tests seguros..."

# Directorio temporal para node_modules local
TEST_MODULES_DIR="__tests__/node_modules"
mkdir -p "$TEST_MODULES_DIR"

# Package.json temporal para tests
cat > __tests__/package.json << 'PACK'
{
    "name": "proyectodragon-tests",
    "version": "1.0.0",
    "private": true,
    "type": "commonjs",
    "scripts": {
        "test": "jest --config=./config/jest.test.config.cjs"
    },
    "devDependencies": {
        "jest": "^29.7.0"
    }
}
PACK

# Instalar dependencias en directorio temporal
cd __tests__
npm install --no-save
cd ..

# Ejecutar tests
echo "Ejecutando tests..."
cd __tests__ && npm test && cd ..

echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] Tests completados"
