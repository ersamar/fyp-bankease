'use server';

import { ID, Query } from "node-appwrite";
import { createAdminClient, createSessionClient } from "../appwrite";
import { cookies } from "next/headers";
import { extractCustomerIdFromUrl, parseStringify } from "../utils";
import { plaidClient } from "@/lib/plaid";
import { CountryCode, Products } from "plaid";
import { addFundingSource, createDwollaCustomer } from "./dwolla.actions";
import crypto from "crypto";
import { account } from '../appwrite';


const {
  APPWRITE_DATABASE_ID: DATABASE_ID,
  APPWRITE_USER_COLLECTION_ID: USER_COLLECTION_ID,
  APPWRITE_BANK_COLLECTION_ID: BANK_COLLECTION_ID,
} = process.env;

if (!DATABASE_ID || !USER_COLLECTION_ID || !BANK_COLLECTION_ID) {
  console.error('❌ Appwrite environment variables are not set correctly');
}

// --- TYPES ---

interface SignInProps {
  email: string;
  password: string;
}

interface SignUpParams {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string,
  ssn: string,
  address1: string,
  city: string,
  state: string,
  postalCode: string
}

interface GetUserInfoProps {
  userId: string;
}

interface CreateBankAccountProps {
  userId: string;
  bankId: string;
  accountId: string;
  accessToken: string;
  fundingSourceUrl: string;
  shareableId: string;
}

interface GetBanksProps {
  userId: string;
}

interface GetBankProps {
  documentId: string;
}

interface GetBankByAccountIdProps {
  accountId: string;
}

interface UpdateUserInfoProps {
  userId: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

interface UpdateBankProps {
  documentId: string;
  updates: Partial<CreateBankAccountProps>;
}

export interface User {
  $id: string;
  firstName: string;
  lastName: string;
  email: string;

  // Add these for verification
  verified?: boolean;
  verificationToken?: string;
  verificationTokenExpiry?: string;
}

// --- AUTH ---

export const signIn = async ({ email, password }: SignInProps) => {
  try {
    const { account } = await createAdminClient();
    
    // Clear any existing sessions first
    try {
      await account.deleteSession('current');
    } catch (error) {
      console.log('No active session to clear');
    }

    // Create new session
    const session = await account.createEmailPasswordSession(email, password);

    // Set session cookie with expiration
    cookies().set("appwrite-session", session.secret, {
      path: "/",
      httpOnly: true,
      sameSite: "strict",
      secure: true,
      maxAge: 3600, // 1 hour expiration
    });

    const user = await getUserInfo({ userId: session.userId });
    return parseStringify(user);
  } catch (error) {
    throw new Error("Invalid credentials or server error");
  }
};

export const signUp = async ({ 
  email, 
  password, 
  firstName, 
  lastName,
  dateOfBirth,
  ssn,
  address1,
  city,
  state,
  postalCode
}: SignUpParams) => {
  try {
    // Validate all required fields
    const requiredFields = {
      email, password, firstName, lastName, dateOfBirth,
      ssn, address1, city, state, postalCode
    }

    for (const [field, value] of Object.entries(requiredFields)) {
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        throw new Error(`Missing required field: ${field}`)
      }
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('Please enter a valid email address')
    }

    // Validate password strength
    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters long')
    }

    const { account, database } = await createAdminClient()

    // Check if email already exists in Appwrite DB
    const existingUsers = await database.listDocuments(
      DATABASE_ID,
      USER_COLLECTION_ID,
      [Query.equal("email", [email])]
    )
    if (existingUsers.total > 0) {
      throw new Error("Email already registered. Please use a different email.")
    }

    // Create Appwrite account
    const newUser = await account.create(
      ID.unique(),
      email,
      password,
      `${firstName} ${lastName}`
    )
    if (!newUser?.$id) {
      throw new Error("Failed to create user account")
    }

    // Try to create Dwolla customer
    let dwollaCustomerUrl = null
    try {
      dwollaCustomerUrl = await createDwollaCustomer({
        email,
        firstName,
        lastName,
        type: "personal",
        address1,
        city,
        state,
        postalCode,
        dateOfBirth,
        ssn
      })
    } catch (dwollaError: any) {
      // Handle duplicate customer error gracefully
      if (dwollaError?.body?._embedded?.errors?.some((e: any) => e.code === "Duplicate" && e.path === "/email")) {
        // Extract the existing customer URL from error to reuse
        const duplicateError = dwollaError.body._embedded.errors.find((e: any) => e.code === "Duplicate" && e.path === "/email")
        dwollaCustomerUrl = duplicateError._links.about.href
      } else {
        throw dwollaError
      }
    }

    if (!dwollaCustomerUrl) {
      throw new Error("Failed to create or retrieve payment processor customer")
    }

    const dwollaCustomerId = extractCustomerIdFromUrl(dwollaCustomerUrl)
    if (!dwollaCustomerId) {
      throw new Error("Failed to extract customer ID")
    }

    // Save user to Appwrite database
    const appwriteUser = await database.createDocument(
      DATABASE_ID,
      USER_COLLECTION_ID,
      ID.unique(),
      {
        userId: newUser.$id,
        email,
        firstName,
        lastName,
        address1,
        city,
        state,
        postalCode,
        dateOfBirth,
        ssn,
        dwollaCustomerId,
        dwollaCustomerUrl
      }
    )

    // Create user session
    const session = await account.createEmailPasswordSession(email, password)
    cookies().set("appwrite-session", session.secret, {
      path: "/",
      httpOnly: true,
      sameSite: "strict",
      secure: true,
    })

    return parseStringify(appwriteUser)
  } catch (error: any) {
    console.error("SignUp Error:", {
      message: error.message,
      stack: error.stack,
      fullError: error
    })

    if (error.message.includes("Validation error")) {
      // Check Dwolla embedded errors for duplicate email
      try {
        const body = JSON.parse(error.message)
        const duplicateError = body._embedded?.errors?.find((e: any) => e.code === "Duplicate" && e.path === "/email")
        if (duplicateError) {
          throw new Error("Email already registered in payment processor. Please use a different email.")
        }
      } catch {
        // fallback if parsing fails
      }
      throw new Error("Please fill all required fields with valid information")
    }
    if (error.message.includes("already exists")) {
      throw new Error("Email already registered. Please use a different email.")
    }
    if (error.message.includes("Missing required field")) {
      throw error
    }

    throw new Error(error.message || "Failed to create account. Please try again.")
  }
}

//Password reset

export const createRecovery = async (email: string) => {
  try {
    const { account } = await createAdminClient();

    const resetUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/reset-password`;
    return await account.createRecovery(email, resetUrl);
  } catch (error: any) {
    console.error("Password Recovery Error:", error.message || error);
    throw new Error("Failed to send recovery email. Please check your email address.");
  }
};
export const resetPassword = async ({
  userId,
  secret,
  newPassword
}: {
  userId: string;
  secret: string;
  newPassword: string;
}) => {
  try {
    const { account } = await createAdminClient();

    // FIXED: Removed extra argument
    return await account.updateRecovery(userId, secret, newPassword);
  } catch (error: any) {
    console.error("Password Reset Error:", error.message || error);
    throw new Error("Failed to reset password. The link may be expired or invalid.");
  }
};


// --- USER ---

export const getUserInfo = async ({ userId }: GetUserInfoProps) => {
  try {
    const { database } = await createAdminClient();

    const result = await database.listDocuments(
      DATABASE_ID,
      USER_COLLECTION_ID,
      [Query.equal("userId", [userId])]
    );

    if (!result?.documents?.length) throw new Error("User not found");

    return parseStringify(result.documents[0]);
  } catch (error) {
    throw new Error("Failed to get user information");
  }
};

export const getLoggedInUser = async () => {
  try {
    const { account } = await createSessionClient();
    
    // First check if we have a valid session
    const session = await account.getSession('current');
    if (!session || new Date(session.expire) < new Date()) {
      await account.deleteSession('current');
      return null;
    }

    // Then get user info
    const sessionUser = await account.get();
    if (!sessionUser?.$id) return null;

    const user = await getUserInfo({ userId: sessionUser.$id });
    return parseStringify(user);
  } catch (error) {
    return null;
  }
};

export const clearSession = async () => {
  try {
    const { account } = await createSessionClient();
    await account.deleteSession('current');
  } catch (error) {
    console.error('Error clearing session:', error);
  }
};

export const logoutAccount = async () => {
  try {
    // Start both operations in parallel
    const { account } = await createSessionClient();
    const deletePromise = account.deleteSession("current").catch(console.error);
    
    // Immediately clear the local cookie without waiting
    cookies().delete("appwrite-session");
    
    // Optional: Add localStorage/sessionStorage clear if you use them
    if (typeof window !== 'undefined') {
      localStorage.removeItem('userState');
      sessionStorage.clear();
    }
    
    // Don't wait for the delete operation to complete
    return { success: true };
    
  } catch (error) {
    console.error("Logout error:", error);
    // Still return success since we've cleared local session
    return { success: true, error: "Server logout failed but local session cleared" };
  }
};

// --- PLAID ---

export const createLinkToken = async (user: User) => {
  try {
    if (!user?.$id) throw new Error("User ID is missing");

    const token = await plaidClient.linkTokenCreate({
      user: { client_user_id: user.$id },
      client_name: `${user.firstName} ${user.lastName}`,
      products: ['auth', 'transactions'] as Products[],
      language: 'en',
      country_codes: ['US'] as CountryCode[],
    });

    return parseStringify({ linkToken: token.data.link_token });
  } catch (error) {
    throw new Error("Failed to create Plaid link token");
  }
};

export const exchangePublicToken = async (public_token: string) => {
  try {
    const exchange = await plaidClient.itemPublicTokenExchange({ public_token });
    return {
      accessToken: exchange.data.access_token,
      itemId: exchange.data.item_id,
    };
  } catch (error: any) {
    const message = error?.response?.data || error.message;
    throw new Error("Failed to exchange public token");
  }
};

// --- BANK ACCOUNTS ---

export const createBankAccount = async ({
  userId,
  bankId,
  accountId,
  accessToken,
  fundingSourceUrl,
  shareableId,
}: CreateBankAccountProps) => {
  try {
    const { database } = await createAdminClient();
    
    const existingAccounts = await database.listDocuments(
      DATABASE_ID!,
      BANK_COLLECTION_ID!,
      [
        Query.equal("userId", [userId]),
        Query.equal("accountId", [accountId])
      ]
    );

    if (existingAccounts.total > 0) {
      return parseStringify(existingAccounts.documents[0]);
    }

    const newBank = await database.createDocument(
      DATABASE_ID!,
      BANK_COLLECTION_ID!,
      ID.unique(),
      {
        userId,
        bankId,
        accountId,
        accessToken,
        fundingSourceUrl,
        shareableId,
      }
    );
    
    return parseStringify(newBank);
  } catch (error) {
    throw new Error("Failed to create bank account");
  }
};

export const getBanks = async ({ userId }: GetBanksProps) => {
  try {
    const { database } = await createAdminClient();

    const result = await database.listDocuments(
      DATABASE_ID!,
      BANK_COLLECTION_ID!,
      [Query.equal("userId", [userId])]
    );

    if (!result || !result.documents) {
      console.warn("⚠️ No documents found for userId:", userId);
      return [];
    }

    return parseStringify(result.documents);
  } catch (error) {
    return [];
  }
};

export const getBank = async ({ documentId }: { documentId: string }) => {
  try {

    const { database } = await createAdminClient();

    const bank = await database.getDocument(DATABASE_ID!, BANK_COLLECTION_ID!, documentId);

    if (!bank) {
      console.warn("⚠️ [getBank] No bank document found for ID:", documentId);
      return null;
    }

    return parseStringify(bank);  // Returning the parsed data
  } catch (error: unknown) {
    console.error("❌ [getBank] Error fetching bank account:", error instanceof Error ? error.message : error);
    return null;
  }
};

export const getBankByAccountId = async ({ accountId }: { accountId: string }) => {
  try {
    const { database } = await createAdminClient();
    
    // First try to find by accountId
    let result = await database.listDocuments(
      DATABASE_ID!,
      BANK_COLLECTION_ID!,
      [Query.equal("accountId", accountId), Query.limit(1)]
    );

    // If not found, try by shareableId
    if (result.total === 0) {
      result = await database.listDocuments(
        DATABASE_ID!,
        BANK_COLLECTION_ID!,
        [Query.equal("shareableId", accountId), Query.limit(1)]
      );
    }

    if (result.total === 0) {
      console.warn(`No bank found for ID: ${accountId}`);
      return null;
    }
    
    return parseStringify(result.documents[0]);
  } catch (error) {
    console.error("Error getting bank by ID:", error);
    return null;
  }
};

export const updateUserInfo = async ({ userId, ...updates }: UpdateUserInfoProps) => {
  try {
    const { database } = await createAdminClient();
    const existing = await getUserInfo({ userId });

    const updated = await database.updateDocument(
      DATABASE_ID!,
      USER_COLLECTION_ID!,
      existing.$id,
      updates
    );

    return parseStringify(updated);
  } catch (error) {
    throw new Error("Failed to update user info");
  }
};

export const updateBankAccount = async ({ documentId, updates }: UpdateBankProps) => {
  try {
    const { database } = await createAdminClient();
    const result = await database.updateDocument(
      DATABASE_ID!,
      BANK_COLLECTION_ID!,
      documentId,
      updates
    );
    return parseStringify(result);
  } catch (error) {
    throw new Error("Failed to update bank account");
  }
};
