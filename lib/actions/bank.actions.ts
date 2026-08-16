"use server";

import { parseStringify } from "../utils";
import { getTransactionsByBankId } from "./transaction.actions";
import { getBanks, getBank } from "./user.actions";
import { readDb } from "../local-db";

// Types
interface AccountResponse {
  id: string;
  availableBalance: number;
  currentBalance: number;
  institutionId: string;
  name: string;
  officialName: string;
  mask: string;
  type: string;
  subtype: string;
  appwriteItemId: string;
  shareableId: string;
}

interface TransferTransaction {
  id: string;
  name: string;
  amount: number;
  date: string;
  paymentChannel: string;
  category: string;
  type: string;
}

interface getAccountsProps {
  userId: string;
}

interface getAccountProps {
  appwriteItemId: string;
}

interface getInstitutionProps {
  institutionId: string;
}

interface getTransactionsProps {
  accessToken: string;
}

// Get multiple bank accounts
export const getAccounts = async ({ userId }: getAccountsProps) => {
  try {
    const banks = await getBanks({ userId }) || [];
    if (banks.length === 0) {
      return parseStringify({
        data: [],
        totalBanks: 0,
        totalCurrentBalance: 0,
      });
    }

    const accounts: AccountResponse[] = banks.map((bank: any) => ({
      id: bank.accountId,
      availableBalance: bank.availableBalance || 0,
      currentBalance: bank.currentBalance || 0,
      institutionId: bank.institutionId || "ins_123",
      name: bank.bankName || "Checking",
      officialName: bank.officialName || "",
      mask: bank.mask || "",
      type: bank.type || "depository",
      subtype: bank.subtype || "checking",
      appwriteItemId: bank.$id,
      shareableId: bank.shareableId,
    }));

    const totalBanks = accounts.length;
    const totalCurrentBalance = accounts.reduce((total, account) => {
      return total + account.currentBalance;
    }, 0);

    return parseStringify({
      data: accounts,
      totalBanks,
      totalCurrentBalance,
    });
  } catch (error) {
    console.error("Error fetching accounts:", error);
    return parseStringify({
      data: [],
      totalBanks: 0,
      totalCurrentBalance: 0,
    });
  }
};

// Get one bank account
export const getAccount = async ({ appwriteItemId }: getAccountProps) => {
  try {
    if (!appwriteItemId) {
      throw new Error("Missing Bank ID.");
    }

    const bank = await getBank({ documentId: appwriteItemId });
    if (!bank) {
      throw new Error(`Bank not found with ID: ${appwriteItemId}`);
    }

    const account = {
      id: bank.accountId,
      availableBalance: bank.availableBalance || 0,
      currentBalance: bank.currentBalance || 0,
      institutionId: bank.institutionId || "ins_123",
      name: bank.bankName || "Checking",
      officialName: bank.officialName || "",
      mask: bank.mask || "",
      type: bank.type || "depository",
      subtype: bank.subtype || "checking",
      appwriteItemId: bank.$id,
    };

    const transferTransactionsData = await getTransactionsByBankId({
      bankId: bank.$id,
    });

    const transferTransactions: TransferTransaction[] = transferTransactionsData.documents.map((transferData: any) => ({
      id: transferData.$id,
      name: transferData.name || '',
      amount: Number(transferData.amount) || 0,
      date: transferData.$createdAt,
      paymentChannel: transferData.channel || '',
      category: transferData.category || '',
      type: transferData.senderBankId === bank.$id ? "debit" : "credit",
    }));

    const db = await readDb();
    const dbTransactions = db.transactions.filter(t => t.senderBankId === bank.$id || t.receiverBankId === bank.$id);
    const mappedDbTransactions: TransferTransaction[] = dbTransactions.map((tx: any) => ({
      id: tx.$id,
      name: tx.name || '',
      amount: Number(tx.amount) || 0,
      date: tx.$createdAt,
      paymentChannel: tx.channel || 'online',
      category: tx.category || 'Transfer',
      type: tx.senderBankId === bank.$id ? "debit" : "credit",
    }));

    const transactionMap = new Map<string, TransferTransaction>();
    [...transferTransactions, ...mappedDbTransactions].forEach(tx => {
      transactionMap.set(tx.id, tx);
    });

    const sortedTransactions = Array.from(transactionMap.values()).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    return parseStringify({
      data: account,
      transactions: sortedTransactions,
    });
  } catch (error: unknown) {
    console.error("Error getting account:", error);
    return parseStringify({
      data: null,
      transactions: [],
    });
  }
};

// Get bank institution info
export const getInstitution = async ({ institutionId }: getInstitutionProps) => {
  return {
    institution_id: institutionId || 'ins_123',
    name: 'Chase Bank',
    products: ['auth', 'transactions'],
    country_codes: ['US'],
    url: 'https://www.chase.com',
    logo: '',
  };
};

// Get Plaid transactions
export const getTransactions = async ({ accessToken }: getTransactionsProps) => {
  return [];
};
