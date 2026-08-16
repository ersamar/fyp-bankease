'use client';

import React, { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { PlaidLinkOptions, usePlaidLink } from 'react-plaid-link';
import { useRouter } from 'next/navigation';
import { createLinkToken } from '@/lib/actions/user.actions';
import Image from 'next/image';

const PlaidLink = ({ user, variant }: PlaidLinkProps) => {
  const router = useRouter();
  const [token, setToken] = useState('');

  useEffect(() => {
    const getLinkToken = async () => {
      try {
        const data = await createLinkToken(user);
        setToken(data?.linkToken);
      } catch (error) {
        console.error('Error creating link token:', error);
      }
    };

    getLinkToken();
  }, [user]);

  const onSuccess = async (public_token: string) => {
    try {
      const response = await fetch('/api/exchange-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ public_token }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Token exchange failed:', error);
        return;
      }

      router.push('/');
    } catch (error) {
      console.error('Error exchanging token:', error);
    }
  };

  // Updated config with required products
  const config: PlaidLinkOptions = {
    token,
    onSuccess,
    // Add this:
    product: ['auth', 'transactions'], // Required for transactions access
    // Optional: Add country codes if needed
    countryCodes: ['US'],
  };

  const { open, ready } = usePlaidLink(config);

  return (
    <>
      {variant === 'primary' ? (
        <Button 
          onClick={() => open()} 
          disabled={!ready} 
          className="plaidlink-primary"
        >
          Connect bank
        </Button>
      ) : variant === 'ghost' ? (
        <Button 
          onClick={() => open()} 
          variant="ghost" 
          className="plaidlink-ghost"
        >
          <Image
            src="/icons/connect-bank.png"
            alt="connect bank"
            width={24}
            height={24}
          />
          <p className="hidden text-[16px] font-semibold text-black-2 xl:block">
            Connect bank
          </p>
        </Button>
      ) : (
        <Button onClick={() => open()} className="plaidlink-default">
          <Image
            src="/icons/connect-bank.svg"
            alt="connect bank"
            width={24}
            height={24}
          />
          <p className="text-[16px] font-semibold text-white">Connect bank</p>
        </Button>
      )}
    </>
  );
};

export default PlaidLink;