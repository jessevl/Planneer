# PocketBase Hooks Directory
#
# This directory contains JavaScript hooks that extend PocketBase functionality.
# Hooks are loaded automatically when PocketBase starts.
#
# File naming convention:
#   pb_hooks/main.pb.js     - Main hooks file
#   pb_hooks/*.pb.js        - Additional hook files
#
# Documentation: https://pocketbase.io/docs/js-overview/
#
# Example hook (main.pb.js):
#
#   // Log all task creations
#   onRecordAfterCreateRequest((e) => {
#     if (e.collection?.name === "tasks") {
#       console.log("Task created:", e.record.id);
#     }
#   });
#
#   // Custom API endpoint
#   routerAdd("GET", "/api/custom", (c) => {
#     return c.json(200, { message: "Hello from custom endpoint!" });
#   });
