#!/bin/sh
#
# One-time setup for dev-workflow contributors.
# Activates the shared .githooks/ directory.

git config --local core.hooksPath .githooks
echo "Git hooks activated (.githooks/)"
