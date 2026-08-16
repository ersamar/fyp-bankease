"use server";

import { parseStringify } from "../utils";
import { readDb, writeDb, LocalTransaction } from "../local-db";

export type CreateTransactionProps = {
  name: string;
  amount: number | string;
  senderId: string;
  senderBankId: string;
  receiverId: string;
  receiverBankId: string;
  email: string;
};

// Enhanced sanitization functions
const sanitizeText = (text: string): string => {
  if (typeof text !== 'string') return '';
  return text.replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim().slice(0, 255);
};

const sanitizeId = (id: string): string => {
  const cleaned = id.replace(/[^\w\-@]/g, '').slice(0, 36);
  return cleaned;
};

const sanitizeEmail = (email: string): string => {
  if (typeof email !== 'string') return '';
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return '';
  return email.toLowerCase().trim().slice(0, 255);
};

const sanitizeAmount = (amount: string | number): string => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '0.00';
  return Math.max(0, num).toFixed(2);
};

export const createTransaction = async (transaction: CreateTransactionProps) => {
  try {
    const db = await readDb();

    const sanitizedTransaction: LocalTransaction = {
      $id: "tx-" + Math.random().toString(36).substring(2, 11),
      $createdAt: new Date().toISOString(),
      name: sanitizeText(transaction.name),
      amount: sanitizeAmount(transaction.amount),
      senderId: sanitizeId(transaction.senderId),
      senderBankId: sanitizeId(transaction.senderBankId),
      receiverId: sanitizeId(transaction.receiverId),
      receiverBankId: sanitizeId(transaction.receiverBankId),
      email: sanitizeEmail(transaction.email),
      channel: "online",
      category: "Transfer",
    };

    db.transactions.push(sanitizedTransaction);

    // Update balances of the mock accounts
    const senderBankIndex = db.banks.findIndex(b => b.$id === sanitizedTransaction.senderBankId);
    if (senderBankIndex !== -1) {
      db.banks[senderBankIndex].availableBalance -= Number(sanitizedTransaction.amount);
      db.banks[senderBankIndex].currentBalance -= Number(sanitizedTransaction.amount);
    }

    const receiverBankIndex = db.banks.findIndex(b => b.$id === sanitizedTransaction.receiverBankId);
    if (receiverBankIndex !== -1) {
      db.banks[receiverBankIndex].availableBalance += Number(sanitizedTransaction.amount);
      db.banks[receiverBankIndex].currentBalance += Number(sanitizedTransaction.amount);
    }

    await writeDb(db);

    return parseStringify(sanitizedTransaction);
  } catch (error) {
    console.error("[createTransaction ERROR]", error);
    throw new Error(typeof error === 'string' ? error : JSON.stringify(error));
  }
};

export const getTransactionsByBankId = async ({ bankId }: { bankId: string }) => {
  try {
    const db = await readDb();

    const relatedTransactions = db.transactions.filter(
      t => t.senderBankId === bankId || t.receiverBankId === bankId
    );

    const transactions = {
      total: relatedTransactions.length,
      documents: relatedTransactions
    };

    return parseStringify(transactions);
  } catch (error) {
    console.error("[getTransactionsByBankId ERROR]", error);
    return parseStringify({ total: 0, documents: [] });
  }
};