import BankCard from '@/components/BankCard';
import HeaderBox from '@/components/HeaderBox';
import { getAccounts } from '@/lib/actions/bank.actions';
import { getLoggedInUser } from '@/lib/actions/user.actions';
import React from 'react';

interface Account {
  $id: string;
  id: string;
  name: string;
  currentBalance: number;
  mask: string;
  shareableId: string;
  appwriteItemId: string;
}

const MyBanks = async () => {
  const loggedIn = await getLoggedInUser();
  const accountsResponse = await getAccounts({ userId: loggedIn.$id });
  const accounts = accountsResponse.data;

  return (
    <section className="flex min-h-screen">
      <div className="my-banks flex-1 px-6 py-8 overflow-y-auto">
        <HeaderBox 
          title="My Bank Accounts"
          subtext="Effortlessly manage your banking activities."
        />

        <div className="space-y-4">
          <h2 className="header-2">Your cards</h2>
          <div className="flex flex-wrap gap-4">
            {accounts && accounts.map((a: Account) => (
              <BankCard 
                key={a.id}  
                account={a}
                userName={loggedIn?.firstName}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default MyBanks;
