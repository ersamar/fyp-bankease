"use server";

import {
  ACHClass,
  CountryCode,
  TransferAuthorizationCreateRequest,
  TransferCreateRequest,
  TransferNetwork,
  TransferType,
} from "plaid";
import { Query, Models } from "node-appwrite";
import { createAdminClient } from "../appwrite";
import { plaidClient } from "../plaid";
import { parseStringify } from "../utils";

import { getTransactionsByBankId } from "./transaction.actions";
import { getBanks, getBank } from "./user.actions";

const {
  APPWRITE_DATABASE_ID: DATABASE_ID,
  APPWRITE_BANK_COLLECTION_ID: BANK_COLLECTION_ID,
} = process.env;

if (!DATABASE_ID || !BANK_COLLECTION_ID) {
  console.error('❌ Appwrite environment variables not configured');
}

// Types
interface Bank {
  $id: string;
  accessToken: string;
  shareableId: string;
  accountId: string;
}

interface BankDocument extends Models.Document {
  userId: string;
  accountId: string;
  shareableId: string;
  fundingSourceUrl: string;
  bankName?: string;
  accountType?: string;
}

interface PlaidAccount {
  account_id: string;
  balances: {
    available: number | null;
    current: number | null;
  };
  name: string;
  official_name: string | null;
  mask: string | null;
  type: string;
  subtype: string | null;
}

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

interface Transaction {
  id: string;
  name: string;
  paymentChannel: string;
  type: string;
  accountId: string;
  amount: number;
  pending: boolean;
  category: string;
  date: string;
  image?: string;
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
    const { database } = await createAdminClient();

    const banks = await getBanks({ userId }) || [];
    if (banks.length === 0) {
      return parseStringify({
        data: [],
        totalBanks: 0,
        totalCurrentBalance: 0,
      });
    }

    const accountDocuments = await database.listDocuments<BankDocument>(
      DATABASE_ID,
      BANK_COLLECTION_ID,
      [Query.equal("userId", [userId])]
    );

    const accountShareableIds = new Map<string, string>();
    accountDocuments.documents.forEach((doc) => {
      if (doc.accountId && doc.shareableId) {
        accountShareableIds.set(doc.accountId, doc.shareableId);
      }
    });

    const accounts = await Promise.all(
      banks.map(async (bank: Bank) => {
        if (!bank.accessToken) return null;

        const accountsResponse = await plaidClient.accountsGet({
          access_token: bank.accessToken,
        });

        const institutionId = accountsResponse.data.item.institution_id || '';

        const institution = institutionId
          ? await getInstitution({ institutionId })
          : { institution_id: '', name: '', products: [], country_codes: [], url: '', logo: '' };

        if (!bank.$id) return null;

        const filteredAccounts: AccountResponse[] = accountsResponse.data.accounts.map(
          (accountData: PlaidAccount) => {
            const realShareableId = accountShareableIds.get(accountData.account_id) || 'default-id';

            return {
              id: accountData.account_id,
              availableBalance: accountData.balances.available || 0,
              currentBalance: accountData.balances.current || 0,
              institutionId: institution.institution_id,
              name: accountData.name,
              officialName: accountData.official_name || '',
              mask: accountData.mask || '',
              type: accountData.type,
              subtype: accountData.subtype || '',
              appwriteItemId: bank.$id,
              shareableId: realShareableId,
            };
          }
        );

        return filteredAccounts;
      })
    );

    const flattenedAccounts = accounts.flat().filter(Boolean) as AccountResponse[];

    const uniqueAccountsMap = new Map<string, AccountResponse>();
    flattenedAccounts.forEach((acc) => {
      if (!uniqueAccountsMap.has(acc.id)) {
        uniqueAccountsMap.set(acc.id, acc);
      }
    });

    const uniqueAccounts = Array.from(uniqueAccountsMap.values());

    const totalBanks = uniqueAccounts.length;
    const totalCurrentBalance = uniqueAccounts.reduce((total, account) => {
      return total + account.currentBalance;
    }, 0);

    return parseStringify({
      data: uniqueAccounts,
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
      throw new Error("Missing Appwrite Bank ID.");
    }

    let bank: Bank;
    try {
      bank = await getBank({ documentId: appwriteItemId });
    } catch (err) {
      throw new Error(`Bank not found with ID: ${appwriteItemId}`);
    }

    if (!bank.accessToken) {
      return parseStringify({
        data: null,
        transactions: [],
      });
    }

    const accountsResponse = await plaidClient.accountsGet({
      access_token: bank.accessToken,
    });

    const accountData = accountsResponse.data.accounts.find(
      (acc) => acc.account_id === bank.accountId
    );

    if (!accountData) {
      return parseStringify({
        data: null,
        transactions: [],
      });
    }

    const institution = await getInstitution({
      institutionId: accountsResponse.data.item.institution_id || '',
    });

    const transferTransactionsData = await getTransactionsByBankId({
      bankId: bank.$id,
    });

    const transferTransactions: TransferTransaction[] = transferTransactionsData.documents.map((transferData: any) => ({
      id: transferData.$id,
      name: transferData.name || '',
      amount: transferData.amount || 0,
      date: transferData.$createdAt,
      paymentChannel: transferData.channel || '',
      category: transferData.category || '',
      type: transferData.senderBankId === bank.$id ? "debit" : "credit",
    }));

    const plaidTransactions = await getTransactions({ accessToken: bank.accessToken });

    const account = {
      id: accountData.account_id,
      availableBalance: accountData.balances.available || 0,
      currentBalance: accountData.balances.current || 0,
      institutionId: institution.institution_id,
      name: accountData.name,
      officialName: accountData.official_name || '',
      mask: accountData.mask || '',
      type: accountData.type,
      subtype: accountData.subtype || '',
      appwriteItemId: bank.$id,
    };

    const allTransactions = [...plaidTransactions, ...transferTransactions].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    return parseStringify({
      data: account,
      transactions: allTransactions,
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
  try {
    const institutionResponse = await plaidClient.institutionsGetById({
      institution_id: institutionId,
      country_codes: ["US"] as CountryCode[],
    });

    const inst = institutionResponse.data.institution;
    return {
      institution_id: inst.institution_id,
      name: inst.name,
      products: inst.products,
      country_codes: inst.country_codes,
      url: inst.url,
      logo: inst.logo,
    };
  } catch (error) {
    console.error("Error getting institution:", error);
    return {
      institution_id: '',
      name: '',
      products: [],
      country_codes: [],
      url: '',
      logo: '',
    };
  }
};

// Get Plaid transactions
export const getTransactions = async ({ accessToken }: getTransactionsProps) => {
  let hasMore = true;
  let transactions: Transaction[] = [];
  let cursor: string | undefined = undefined;

  try {
    while (hasMore) {
      const requestData: any = {
        access_token: accessToken,
      };
      if (cursor) {
        requestData.cursor = cursor;
      }

      const response = await plaidClient.transactionsSync(requestData);

      const newTransactions: Transaction[] = response.data.added.map((transaction) => ({
        id: transaction.transaction_id,
        name: transaction.name,
        paymentChannel: transaction.payment_channel,
        type: transaction.payment_channel,
        accountId: transaction.account_id,
        amount: transaction.amount,
        pending: transaction.pending,
        category: transaction.category ? transaction.category[0] : "",
        date: transaction.date,
        image: transaction.logo_url ?? undefined,
      }));

      transactions.push(...newTransactions);
      hasMore = response.data.has_more;
      cursor = response.data.next_cursor;
    }

    return transactions;
  } catch (error) {
    console.error("Error getting transactions:", error);
    return [];
  }
};
