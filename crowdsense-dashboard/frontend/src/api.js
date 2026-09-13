/**
 * Backward-Compatibility Shim
 *
 * NOTE: The primary, authoritative API client for CrowdSense is located at:
 *   src/api/crowdsense.js
 *
 * This file re-exports all functions from crowdsense.js to preserve compatibility
 * with any legacy imports. New code should import directly from "./api/crowdsense.js".
 */

export * from "./api/crowdsense.js";
