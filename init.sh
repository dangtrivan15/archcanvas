#!/usr/bin/env bash
set -euo pipefail

# ArchCanvas - Development Environment Setup Script
# This script installs dependencies and starts the Vite dev server.

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        ArchCanvas Dev Environment        ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
echo ""

# --- Check prerequisites ---
echo -e "${YELLOW}Checking prerequisites...${NC}"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed. Please install Node.js 20+${NC}"
    exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo -e "${RED}Error: Node.js 20+ required. Found: $(node -v)${NC}"
    exit 1
fi
echo -e "  ${GREEN}✓${NC} Node.js $(node -v)"

# Check npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}Error: npm is not installed.${NC}"
    exit 1
fi
echo -e "  ${GREEN}✓${NC} npm $(npm -v)"

# --- Install dependencies ---
echo ""
echo -e "${YELLOW}Installing dependencies...${NC}"

if [ -f "package.json" ]; then
    npm install
    echo -e "  ${GREEN}✓${NC} Dependencies installed"
else
    echo -e "${RED}Error: package.json not found. Run this script from the project root.${NC}"
    exit 1
fi

# --- Generate Protocol Buffer TypeScript classes ---
echo ""
echo -e "${YELLOW}Generating Protocol Buffer types...${NC}"

if [ -f "proto/archcanvas.proto" ]; then
    npx pbjs -t static-module -w es6 -o src/proto/archcanvas.pb.js proto/archcanvas.proto 2>/dev/null || true
    npx pbts -o src/proto/archcanvas.pb.d.ts src/proto/archcanvas.pb.js 2>/dev/null || true
    echo -e "  ${GREEN}✓${NC} Proto types generated"
else
    echo -e "  ${YELLOW}⚠${NC} Proto file not found yet (will be created during implementation)"
fi

# --- Environment check ---
echo ""
echo -e "${YELLOW}Checking environment variables...${NC}"

if [ -f ".env" ]; then
    echo -e "  ${GREEN}✓${NC} .env file found"
else
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo -e "  ${YELLOW}⚠${NC} Created .env from .env.example - please set VITE_ANTHROPIC_API_KEY"
    else
        echo -e "  ${YELLOW}⚠${NC} No .env file found. AI features require VITE_ANTHROPIC_API_KEY"
    fi
fi

# --- Start development server ---
echo ""
echo -e "${YELLOW}Starting Vite development server...${NC}"
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  App will be available at:               ║${NC}"
echo -e "${GREEN}║  ${BLUE}http://localhost:5173${GREEN}                  ║${NC}"
echo -e "${GREEN}║                                          ║${NC}"
echo -e "${GREEN}║  Press Ctrl+C to stop the server         ║${NC}"
echo -e "${GREEN}║                                          ║${NC}"
echo -e "${GREEN}║  Recommended: Chrome/Edge browser        ║${NC}"
echo -e "${GREEN}║  (for File System Access API support)    ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""

npm run dev
