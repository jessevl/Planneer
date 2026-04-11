# PocketBase JS Migrations Directory
#
# This directory contains JavaScript migrations that can be used alongside
# Go migrations. JS migrations are useful for runtime schema changes that
# don't need to be compiled into the binary.
#
# IMPORTANT: For CI/CD deployments, prefer Go migrations in /migrations/
# as they are embedded in the binary and provide atomic deployments.
#
# JS migrations here are:
# - Loaded at runtime (not compiled)
# - Good for development/prototyping
# - Can be created via Admin UI when PB_DEV=true
#
# To create a JS migration from Admin UI:
# 1. Make schema changes in Admin UI
# 2. Collections export appears in this directory
#
# File naming convention:
#   1234567890_name.js
#
# Documentation: https://pocketbase.io/docs/migrations/
