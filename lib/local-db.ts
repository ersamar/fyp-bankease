import fs from 'fs/promises';
import path from 'path';

const dbPath = path.join(process.cwd(), 'lib', 'db.json');

export interface LocalUser {
  $id: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  address1: string;
  city: string;
  state: string;
  postalCode: string;
  dateOfBirth: string;
  ssn: string;
  dwollaCustomerId: string;
  dwollaCustomerUrl: string;
  password?: string;
}

export interface LocalBank {
  $id: string;
  userId: string;
  bankId: string;
  accountId: string;
  accessToken: string;
  fundingSourceUrl: string;
  shareableId: string;
  availableBalance: number;
  currentBalance: number;
  institutionId: string;
  bankName: string;
  officialName: string;
  mask: string;
  type: string;
  subtype: string;
}

export interface LocalTransaction {
  $id: string;
  $createdAt: string;
  name: string;
  amount: string;
  senderId: string;
  senderBankId: string;
  receiverId: string;
  receiverBankId: string;
  email: string;
  channel: string;
  category: string;
}

export interface LocalDbSchema {
  users: LocalUser[];
  banks: LocalBank[];
  transactions: LocalTransaction[];
}

export async function readDb(): Promise<LocalDbSchema> {
  try {
    const data = await fs.readFile(dbPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    const initial: LocalDbSchema = { users: [], banks: [], transactions: [] };
    try {
      await fs.mkdir(path.dirname(dbPath), { recursive: true });
      await fs.writeFile(dbPath, JSON.stringify(initial, null, 2));
    } catch (writeErr) {
      console.error("Failed to write initial db.json:", writeErr);
    }
    return initial;
  }
}

export async function writeDb(data: LocalDbSchema): Promise<void> {
  try {
    await fs.mkdir(path.dirname(dbPath), { recursive: true });
    await fs.writeFile(dbPath, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Failed to write db.json:", err);
  }
}
