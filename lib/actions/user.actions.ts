'use server';

import { cookies } from "next/headers";
import { parseStringify } from "../utils";
import { readDb, writeDb, LocalUser, LocalBank, LocalTransaction } from "../local-db";

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
  dateOfBirth: string;
  ssn: string;
  address1: string;
  city: string;
  state: string;
  postalCode: string;
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
  verified?: boolean;
}

// --- AUTH ---

export const signIn = async ({ email, password }: SignInProps) => {
  try {
    const db = await readDb();
    let user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    
    if (!user) {
      // Automatically register user if they don't exist to make access seamless
      const userId = "user-" + Math.random().toString(36).substring(2, 11);
      user = {
        $id: userId,
        userId,
        email: email.toLowerCase(),
        firstName: "Guest",
        lastName: "User",
        address1: "123 Main St",
        city: "New York",
        state: "NY",
        postalCode: "10001",
        dateOfBirth: "1990-01-01",
        ssn: "000-00-0000",
        dwollaCustomerId: "dwolla-" + Math.random().toString(36).substring(2, 11),
        dwollaCustomerUrl: "https://api-sandbox.dwolla.com/customers/mock",
      };
      db.users.push(user);

      // Pre-populate with default bank accounts
      const bank1: LocalBank = {
        $id: "bank-" + Math.random().toString(36).substring(2, 11),
        userId: user.userId,
        bankId: "ins_123",
        accountId: "acc-chase",
        accessToken: "access-sandbox-mock-1",
        fundingSourceUrl: "https://api-sandbox.dwolla.com/funding-sources/mock-1",
        shareableId: "shareable-chase",
        availableBalance: 4850.25,
        currentBalance: 5120.50,
        institutionId: "ins_123",
        bankName: "Chase Checking",
        officialName: "Chase Checking Account",
        mask: "4321",
        type: "depository",
        subtype: "checking"
      };
      const bank2: LocalBank = {
        $id: "bank-" + Math.random().toString(36).substring(2, 11),
        userId: user.userId,
        bankId: "ins_123",
        accountId: "acc-savings",
        accessToken: "access-sandbox-mock-2",
        fundingSourceUrl: "https://api-sandbox.dwolla.com/funding-sources/mock-2",
        shareableId: "shareable-savings",
        availableBalance: 12500.00,
        currentBalance: 12500.00,
        institutionId: "ins_123",
        bankName: "Chase Savings",
        officialName: "Chase Savings Account",
        mask: "9876",
        type: "depository",
        subtype: "savings"
      };
      db.banks.push(bank1, bank2);

      // Pre-populate with sample transactions
      const tx1: LocalTransaction = {
        $id: "tx-1",
        $createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
        name: "Starbucks Cafe",
        amount: "14.50",
        senderId: user.userId,
        senderBankId: bank1.$id,
        receiverId: "merchant-starbucks",
        receiverBankId: "merchant-starbucks-bank",
        email: "merchant@starbucks.com",
        channel: "in store",
        category: "Food"
      };
      const tx2: LocalTransaction = {
        $id: "tx-2",
        $createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
        name: "Employer Payroll",
        amount: "2500.00",
        senderId: "employer",
        senderBankId: "employer-bank",
        receiverId: user.userId,
        receiverBankId: bank1.$id,
        email: email,
        channel: "online",
        category: "Income"
      };
      db.transactions.push(tx1, tx2);

      await writeDb(db);
    }

    cookies().set("appwrite-session", user.userId, {
      path: "/",
      httpOnly: true,
      sameSite: "strict",
      secure: true,
      maxAge: 3600 * 24, // 24 hours
    });

    return parseStringify(user);
  } catch (error) {
    throw new Error("Invalid credentials or server error");
  }
};

export const signUp = async (userData: SignUpParams) => {
  try {
    const db = await readDb();
    
    // Check if email already registered
    const existing = db.users.find(u => u.email.toLowerCase() === userData.email.toLowerCase());
    if (existing) {
      throw new Error("Email already registered");
    }

    const userId = "user-" + Math.random().toString(36).substring(2, 11);
    const newUser: LocalUser = {
      $id: userId,
      userId,
      email: userData.email.toLowerCase(),
      firstName: userData.firstName,
      lastName: userData.lastName,
      address1: userData.address1,
      city: userData.city,
      state: userData.state,
      postalCode: userData.postalCode,
      dateOfBirth: userData.dateOfBirth,
      ssn: userData.ssn,
      dwollaCustomerId: "dwolla-" + Math.random().toString(36).substring(2, 11),
      dwollaCustomerUrl: "https://api-sandbox.dwolla.com/customers/mock",
    };

    db.users.push(newUser);

    // Create default bank accounts
    const bank1: LocalBank = {
      $id: "bank-" + Math.random().toString(36).substring(2, 11),
      userId: newUser.userId,
      bankId: "ins_123",
      accountId: "acc-chase",
      accessToken: "access-sandbox-mock-1",
      fundingSourceUrl: "https://api-sandbox.dwolla.com/funding-sources/mock-1",
      shareableId: "shareable-chase",
      availableBalance: 4850.25,
      currentBalance: 5120.50,
      institutionId: "ins_123",
      bankName: "Chase Checking",
      officialName: "Chase Checking Account",
      mask: "4321",
      type: "depository",
      subtype: "checking"
    };
    const bank2: LocalBank = {
      $id: "bank-" + Math.random().toString(36).substring(2, 11),
      userId: newUser.userId,
      bankId: "ins_123",
      accountId: "acc-savings",
      accessToken: "access-sandbox-mock-2",
      fundingSourceUrl: "https://api-sandbox.dwolla.com/funding-sources/mock-2",
      shareableId: "shareable-savings",
      availableBalance: 12500.00,
      currentBalance: 12500.00,
      institutionId: "ins_123",
      bankName: "Chase Savings",
      officialName: "Chase Savings Account",
      mask: "9876",
      type: "depository",
      subtype: "savings"
    };
    db.banks.push(bank1, bank2);

    // Create sample transactions
    const tx1: LocalTransaction = {
      $id: "tx-1",
      $createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      name: "Starbucks Cafe",
      amount: "14.50",
      senderId: newUser.userId,
      senderBankId: bank1.$id,
      receiverId: "merchant-starbucks",
      receiverBankId: "merchant-starbucks-bank",
      email: "merchant@starbucks.com",
      channel: "in store",
      category: "Food"
    };
    const tx2: LocalTransaction = {
      $id: "tx-2",
      $createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
      name: "Employer Payroll",
      amount: "2500.00",
      senderId: "employer",
      senderBankId: "employer-bank",
      receiverId: newUser.userId,
      receiverBankId: bank1.$id,
      email: userData.email,
      channel: "online",
      category: "Income"
    };
    db.transactions.push(tx1, tx2);

    await writeDb(db);

    cookies().set("appwrite-session", newUser.userId, {
      path: "/",
      httpOnly: true,
      sameSite: "strict",
      secure: true,
    });

    return parseStringify(newUser);
  } catch (error: any) {
    throw new Error(error.message || "Failed to create account. Please try again.");
  }
};

// Password reset
export const createRecovery = async (email: string) => {
  return parseStringify({ success: true });
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
  return parseStringify({ success: true });
};

// --- USER ---

export const getUserInfo = async ({ userId }: GetUserInfoProps) => {
  try {
    const db = await readDb();
    const user = db.users.find(u => u.userId === userId || u.$id === userId);
    if (!user) throw new Error("User not found");

    return parseStringify(user);
  } catch (error) {
    throw new Error("Failed to get user information");
  }
};

export const getLoggedInUser = async () => {
  try {
    const sessionCookie = cookies().get("appwrite-session");
    if (!sessionCookie || !sessionCookie.value) {
      return null;
    }

    const db = await readDb();
    const user = db.users.find(u => u.userId === sessionCookie.value);
    return user ? parseStringify(user) : null;
  } catch (error) {
    return null;
  }
};

export const clearSession = async () => {
  try {
    cookies().delete("appwrite-session");
  } catch (error) {
    console.error('Error clearing session:', error);
  }
};

export const logoutAccount = async () => {
  try {
    cookies().delete("appwrite-session");
    return { success: true };
  } catch (error) {
    console.error("Logout error:", error);
    return { success: true };
  }
};

// --- PLAID ---

export const createLinkToken = async (user: User) => {
  return parseStringify({ linkToken: "mock-link-token" });
};

export const exchangePublicToken = async (public_token: string) => {
  return {
    accessToken: "mock-access-token-" + Math.random().toString(36).substring(2, 11),
    itemId: "mock-item-id-" + Math.random().toString(36).substring(2, 11),
  };
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
    const db = await readDb();
    
    const existing = db.banks.find(b => b.userId === userId && b.accountId === accountId);
    if (existing) {
      return parseStringify(existing);
    }

    const newBank: LocalBank = {
      $id: "bank-" + Math.random().toString(36).substring(2, 11),
      userId,
      bankId,
      accountId,
      accessToken,
      fundingSourceUrl,
      shareableId,
      availableBalance: 5000.00,
      currentBalance: 5000.00,
      institutionId: "ins_123",
      bankName: "Mock Bank Account",
      officialName: "Mock checking bank account",
      mask: "0000",
      type: "depository",
      subtype: "checking",
    };

    db.banks.push(newBank);
    await writeDb(db);
    
    return parseStringify(newBank);
  } catch (error) {
    throw new Error("Failed to create bank account");
  }
};

export const getBanks = async ({ userId }: GetBanksProps) => {
  try {
    const db = await readDb();
    const userBanks = db.banks.filter(b => b.userId === userId);
    return parseStringify(userBanks);
  } catch (error) {
    return [];
  }
};

export const getBank = async ({ documentId }: { documentId: string }) => {
  try {
    const db = await readDb();
    const bank = db.banks.find(b => b.$id === documentId);
    return bank ? parseStringify(bank) : null;
  } catch (error) {
    return null;
  }
};

export const getBankByAccountId = async ({ accountId }: { accountId: string }) => {
  try {
    const db = await readDb();
    const bank = db.banks.find(b => b.accountId === accountId || b.shareableId === accountId);
    return bank ? parseStringify(bank) : null;
  } catch (error) {
    return null;
  }
};

export const updateUserInfo = async ({ userId, ...updates }: UpdateUserInfoProps) => {
  try {
    const db = await readDb();
    const index = db.users.findIndex(u => u.userId === userId);
    if (index === -1) throw new Error("User not found");
    
    db.users[index] = { ...db.users[index], ...updates };
    await writeDb(db);
    return parseStringify(db.users[index]);
  } catch (error) {
    throw new Error("Failed to update user info");
  }
};

export const updateBankAccount = async ({ documentId, updates }: UpdateBankProps) => {
  try {
    const db = await readDb();
    const index = db.banks.findIndex(b => b.$id === documentId);
    if (index === -1) throw new Error("Bank not found");
    
    db.banks[index] = { ...db.banks[index], ...updates } as LocalBank;
    await writeDb(db);
    return parseStringify(db.banks[index]);
  } catch (error) {
    throw new Error("Failed to update bank account");
  }
};
