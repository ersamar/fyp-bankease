import { NextResponse } from 'next/server';
import { createBankAccount, getLoggedInUser } from '@/lib/actions/user.actions';

export async function POST(req: Request) {
  try {
    const user = await getLoggedInUser();
    if (!user) throw new Error("User must be logged in");

    // Create a mock checking account
    const checkingBank = await createBankAccount({
      userId: user.userId,
      bankId: "mock_bank_" + Math.random().toString(36).substring(2, 6),
      accountId: "acc-checking-" + Math.random().toString(36).substring(2, 6),
      accessToken: "mock-access-token",
      fundingSourceUrl: "mock-funding-source-url",
      shareableId: "shareable-checking-" + Math.random().toString(36).substring(2, 6),
    });

    return NextResponse.json({ success: true, createdAccounts: [checkingBank] });
  } catch (error: any) {
    console.error('Error in /api/exchange-token:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
