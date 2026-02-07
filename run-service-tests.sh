#!/bin/bash

# Service Layer Test Runner for Cash.io
# Runs comprehensive tests for agents, blob-storage, and SDK packages

echo "=================================="
echo "Cash.io Service Layer Test Suite"
echo "=================================="
echo ""

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

failed_tests=0
passed_tests=0

# Test each service package
test_package() {
  local package_name=$1
  local package_path=$2
  
  echo -e "${BLUE}Testing ${package_name}...${NC}"
  cd "$package_path" || exit 1
  
  # Run tests
  npm test 2>&1 | tee "test-output.log"
  
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ ${package_name} tests passed${NC}"
    ((passed_tests++))
  else
    echo -e "${YELLOW}✗ ${package_name} tests failed${NC}"
    ((failed_tests++))
  fi
  
  echo ""
}

# Run tests for each package
test_package "Agents" "packages/agents"
test_package "Blob Storage" "packages/blob-storage"
test_package "SDK" "packages/sdk"

# Summary
echo "=================================="
echo -e "${BLUE}Test Summary${NC}"
echo "=================================="
echo -e "${GREEN}Passed: ${passed_tests}${NC}"
echo -e "${YELLOW}Failed: ${failed_tests}${NC}"
echo ""

if [ $failed_tests -eq 0 ]; then
  echo -e "${GREEN}All service tests passed!${NC}"
  exit 0
else
  echo -e "${YELLOW}Some tests failed. Review logs above.${NC}"
  exit 1
fi
