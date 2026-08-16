import { NextResponse } from 'next/server';
import { exchangePublicToken, createBankAccount, getLoggedInUser } from '@/lib/actions/user.actions';
import { plaidClient } from '@/lib/plaid';
import { ProcessorTokenCreateRequestProcessorEnum } from 'plaid';
import { addFundingSource } from '@/lib/actions/dwolla.actions';

export async function POST(req: Request) {
  const { public_token } = await req.json();

  try {
    const user = await getLoggedInUser();
    if (!user) throw new Error("User must be logged in");

    const { accessToken, itemId } = await exchangePublicToken(public_token);
    const { data: accountsData } = await plaidClient.accountsGet({ access_token: accessToken });

    const createdAccounts = [];

    for (const account of accountsData.accounts) {
      if (['checking', 'savings'].includes(account.subtype ?? '')) {
        const processorTokenResponse = await plaidClient.processorTokenCreate({
          access_token: accessToken,
          account_id: account.account_id,
          processor: ProcessorTokenCreateRequestProcessorEnum.Dwolla,
        });

        const processorToken = processorTokenResponse.data.processor_token;

        const { fundingSourceUrl, shareableId } = await addFundingSource({
          dwollaCustomerId: user.dwollaCustomerId, // Make sure this is available on the user
          processorToken,
          bankName: account.name,
        });

        const bank = await createBankAccount({
          userId: user.$id,
          bankId: itemId,
          accountId: account.account_id,
          accessToken,
          fundingSourceUrl,
          shareableId,
        });

        createdAccounts.push(bank);
      }
    }

    return NextResponse.json({ success: true, createdAccounts });
  } catch (error: any) {
    console.error('Error in /api/exchange-token:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
