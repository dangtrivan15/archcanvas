#!/usr/bin/env bash
set -euo pipefail

# ArchCanvas - Development Environment Setup Script
# Installs dependencies, checks prerequisites, and starts the dev server.

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
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

# Check Rust (needed for Tauri)
if ! command -v rustc &> /dev/null; then
    echo -e "${YELLOW}  ⚠ Rust not found — Tauri desktop builds won't work.${NC}"
    echo -e "${YELLOW}    Install: https://rustup.rs${NC}"
else
    echo -e "  ${GREEN}✓${NC} Rust $(rustc --version | cut -d' ' -f2)"
fi

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

# --- Environment check ---
echo ""
echo -e "${YELLOW}Checking environment variables...${NC}"

if [ -f ".env" ]; then
    echo -e "  ${GREEN}✓${NC} .env file found"
else
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo -e "  ${YELLOW}⚠${NC} Created .env from .env.example"
    else
        echo -e "  ${YELLOW}⚠${NC} No .env file found"
    fi
fi

# --- Start development server ---
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Setup complete! Starting dev server...  ║${NC}"
echo -e "${GREEN}║  http://localhost:5173                   ║${NC}"
echo -e "${GREEN}║  Press Ctrl+C to stop.                   ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""
exec npm run dev
