import { Router } from "express";
import { handleTelegramWebhook, handleTenantTelegramWebhook } from "../telegram/webhook";

const router = Router();

// Legacy Telegram Webhook endpoint (for backward compatibility)
router.post("/webhook", handleTelegramWebhook);

// Tenant-specific Telegram Webhook endpoint
// Each tenant has their own webhook URL: /api/telegram/webhook/:organizationSlug
router.post("/webhook/:organizationSlug", handleTenantTelegramWebhook);

export default router;
