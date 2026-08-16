"use server";

import { ID, Query } from "node-appwrite";
import { createAdminClient } from "../appwrite";
import { parseStringify } from "../utils";

const {
  APPWRITE_DATABASE_ID: DATABASE_ID,
  APPWRITE_TRANSACTION_COLLECTION_ID: TRANSACTION_COLLECTION_ID,
} = process.env;

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
  // Allow most printable characters except control characters
  return text.replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim().slice(0, 255);
};

const sanitizeId = (id: string): string => {
  const cleaned = id.replace(/[^\w\-@]/g, '').slice(0, 36);
  return cleaned;
};

const sanitizeEmail = (email: string): string => {
  if (typeof email !== 'string') return '';
  // More comprehensive email validation
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
    const { database } = await createAdminClient();

    const sanitizedTransaction = {
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

    const newTransaction = await database.createDocument(
      DATABASE_ID!,
      TRANSACTION_COLLECTION_ID!,
      ID.unique(),
      sanitizedTransaction
    );

    return parseStringify(newTransaction);
  } catch (error) {
    console.error("[createTransaction ERROR]", error);
    throw new Error(typeof error === 'string' ? error : JSON.stringify(error));
  }
};

export const getTransactionsByBankId = async ({ bankId }: { bankId: string }) => {
  try {
    const { database } = await createAdminClient();

    const senderTransactions = await database.listDocuments(
      DATABASE_ID!,
      TRANSACTION_COLLECTION_ID!,
      [Query.equal('senderBankId', bankId)]
    );

    const receiverTransactions = await database.listDocuments(
      DATABASE_ID!,
      TRANSACTION_COLLECTION_ID!,
      [Query.equal('receiverBankId', bankId)]
    );

    const transactions = {
      total: senderTransactions.total + receiverTransactions.total,
      documents: [
        ...senderTransactions.documents,
        ...receiverTransactions.documents,
      ]
    };

    return parseStringify(transactions);
  } catch (error) {
    console.error("[getTransactionsByBankId ERROR]", error);
    return parseStringify({ total: 0, documents: [] });
  }
};