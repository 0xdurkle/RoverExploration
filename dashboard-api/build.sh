#!/bin/bash
# Build script for Railway
# This ensures we're in the right directory

cd "$(dirname "$0")" || exit 1
npm run build
