#!/bin/bash
set -e

cd frontend && npm install --no-audit --no-fund
cd ..
pip install -r requirements.txt --quiet
