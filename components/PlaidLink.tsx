'use client';

import React from 'react';
import { Button } from './ui/button';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

const PlaidLink = ({ user, variant }: PlaidLinkProps) => {
  const router = useRouter();

  const onSuccess = async () => {
    try {
      const response = await fetch('/api/exchange-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ public_token: "mock-public-token-" + Math.random() }),
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

  return (
    <>
      {variant === 'primary' ? (
        <Button 
          onClick={() => onSuccess()} 
          className="plaidlink-primary"
        >
          Connect bank
        </Button>
      ) : variant === 'ghost' ? (
        <Button 
          onClick={() => onSuccess()} 
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
        <Button 
          onClick={() => onSuccess()} 
          className="plaidlink-default"
        >
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