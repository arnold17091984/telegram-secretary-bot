// Crypto Payment Integration
// Supports multiple crypto payment providers

import * as db from "../db";

// Supported cryptocurrencies
export const SUPPORTED_CRYPTOS = {
  BTC: { name: "Bitcoin", symbol: "BTC", network: "bitcoin" },
  ETH: { name: "Ethereum", symbol: "ETH", network: "ethereum" },
  USDT: { name: "Tether", symbol: "USDT", network: "ethereum" },
  USDC: { name: "USD Coin", symbol: "USDC", network: "ethereum" },
} as const;

export type CryptoSymbol = keyof typeof SUPPORTED_CRYPTOS;

// Payment status
export type CryptoPaymentStatus = "pending" | "confirming" | "completed" | "expired" | "failed";

// Crypto payment record
export interface CryptoPayment {
  id: string;
  organizationId: number;
  amount: number;
  currency: string;
  cryptoAmount: string;
  cryptoCurrency: CryptoSymbol;
  walletAddress: string;
  status: CryptoPaymentStatus;
  txHash?: string;
  expiresAt: Date;
  createdAt: Date;
}

// Wallet addresses for receiving payments (should be loaded from env)
const WALLET_ADDRESSES = {
  BTC: process.env.CRYPTO_WALLET_BTC || "",
  ETH: process.env.CRYPTO_WALLET_ETH || "",
  USDT: process.env.CRYPTO_WALLET_USDT || "",
  USDC: process.env.CRYPTO_WALLET_USDC || "",
};

// In-memory storage for pending crypto payments (in production, use database)
const pendingCryptoPayments = new Map<string, CryptoPayment>();

// Generate unique payment ID
function generatePaymentId(): string {
  return `crypto_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

// Get current crypto price (simplified - in production, use a price API)
async function getCryptoPrice(crypto: CryptoSymbol): Promise<number> {
  // Placeholder prices in JPY (should be fetched from an API like CoinGecko)
  const prices: Record<CryptoSymbol, number> = {
    BTC: 15000000, // ~$100,000 USD
    ETH: 500000,   // ~$3,300 USD
    USDT: 150,     // ~$1 USD
    USDC: 150,     // ~$1 USD
  };
  return prices[crypto];
}

// Create a new crypto payment request
export async function createCryptoPayment(
  organizationId: number,
  amountJPY: number,
  cryptoCurrency: CryptoSymbol,
  description?: string
): Promise<CryptoPayment> {
  const walletAddress = WALLET_ADDRESSES[cryptoCurrency];
  
  if (!walletAddress) {
    throw new Error(`Wallet address not configured for ${cryptoCurrency}`);
  }
  
  // Calculate crypto amount
  const cryptoPrice = await getCryptoPrice(cryptoCurrency);
  const cryptoAmount = (amountJPY / cryptoPrice).toFixed(8);
  
  const payment: CryptoPayment = {
    id: generatePaymentId(),
    organizationId,
    amount: amountJPY,
    currency: "JPY",
    cryptoAmount,
    cryptoCurrency,
    walletAddress,
    status: "pending",
    expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes expiry
    createdAt: new Date(),
  };
  
  // Store in memory (in production, store in database)
  pendingCryptoPayments.set(payment.id, payment);
  
  // Create payment record in database
  await db.createPayment({
    organizationId,
    amount: amountJPY,
    currency: "JPY",
    paymentMethod: "crypto",
    paymentStatus: "pending",
    cryptoPaymentId: payment.id,
    description: description || `Crypto payment: ${cryptoAmount} ${cryptoCurrency}`,
  });
  
  return payment;
}

// Get payment by ID
export function getCryptoPayment(paymentId: string): CryptoPayment | undefined {
  return pendingCryptoPayments.get(paymentId);
}

// Update payment status (called by webhook or manual verification)
export async function updateCryptoPaymentStatus(
  paymentId: string,
  status: CryptoPaymentStatus,
  txHash?: string
): Promise<void> {
  const payment = pendingCryptoPayments.get(paymentId);
  
  if (!payment) {
    throw new Error(`Payment not found: ${paymentId}`);
  }
  
  payment.status = status;
  if (txHash) {
    payment.txHash = txHash;
  }
  
  pendingCryptoPayments.set(paymentId, payment);
  
  // Update database record
  const dbPayments = await db.getPaymentsByOrganization(payment.organizationId);
  const dbPayment = dbPayments.find(p => p.cryptoPaymentId === paymentId);
  
  if (dbPayment) {
    const dbStatus = status === "completed" ? "completed" : status === "failed" || status === "expired" ? "failed" : "pending";
    await db.updatePaymentStatus(dbPayment.id, dbStatus);
  }
  
  // If payment completed, update organization subscription
  if (status === "completed") {
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1); // 1 month subscription
    
    await db.updateOrganizationSubscription(
      payment.organizationId,
      "active",
      "pro", // Default to pro plan for crypto payments
      expiresAt
    );
    
    // Create audit log
    await db.createAuditLog({
      userId: "system",
      action: "crypto_payment_completed",
      objectType: "organization",
      objectId: payment.organizationId.toString(),
      payload: JSON.stringify({
        paymentId,
        amount: payment.amount,
        cryptoAmount: payment.cryptoAmount,
        cryptoCurrency: payment.cryptoCurrency,
        txHash,
      }),
    });
  }
}

// Check for expired payments (should be called periodically)
export async function checkExpiredPayments(): Promise<void> {
  const now = new Date();
  
  for (const [paymentId, payment] of Array.from(pendingCryptoPayments)) {
    if (payment.status === "pending" && payment.expiresAt < now) {
      await updateCryptoPaymentStatus(paymentId, "expired");
      console.log(`[Crypto Payment] Payment expired: ${paymentId}`);
    }
  }
}

// Generate payment QR code data (wallet address with amount)
export function generatePaymentQRData(payment: CryptoPayment): string {
  const { cryptoCurrency, walletAddress, cryptoAmount } = payment;
  
  switch (cryptoCurrency) {
    case "BTC":
      return `bitcoin:${walletAddress}?amount=${cryptoAmount}`;
    case "ETH":
    case "USDT":
    case "USDC":
      return `ethereum:${walletAddress}?value=${cryptoAmount}`;
    default:
      return walletAddress;
  }
}

// Get all pending payments for an organization
export function getPendingPayments(organizationId: number): CryptoPayment[] {
  const payments: CryptoPayment[] = [];
  
  for (const payment of Array.from(pendingCryptoPayments.values())) {
    if (payment.organizationId === organizationId && payment.status === "pending") {
      payments.push(payment);
    }
  }
  
  return payments;
}
