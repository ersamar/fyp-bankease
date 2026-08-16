"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
} from "@/components/ui/select";
import { formatAmount, formUrlQuery } from "@/lib/utils";

export const BankDropdown = ({ accounts = [], setValue, otherStyles }: BankDropdownProps) => {
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined); // Start with no selection
  const searchParams = useSearchParams();
  const router = useRouter();

  // Initialize selectedId with the first account's appwriteItemId if it's available
  useEffect(() => {
    if (accounts.length > 0 && selectedId === undefined) {
      // Don't set the value prematurely
      setSelectedId(accounts[0].appwriteItemId);
    }
  }, [accounts, selectedId]);

  // Handle bank selection change
  const handleBankChange = (id: string) => {
    setSelectedId(id);  // Update selectedId state when an option is selected
    if (setValue) {
      setValue("senderBank", id); // Update form value if setValue is provided
    }

    // Update URL with the new selection
    if (searchParams) {
      const newUrl = formUrlQuery({
        params: searchParams.toString(),
        key: "id",
        value: id,
      });
      router.push(newUrl, { scroll: false });
    }
  };

  // If no accounts are available, display a message
  if (accounts.length === 0) {
    return <div>No bank accounts connected.</div>;
  }

  return (
    <Select value={selectedId} onValueChange={handleBankChange} required>
      <SelectTrigger className={`flex w-full bg-white gap-3 md:w-[300px] ${otherStyles}`}>
        <Image
          src="/icons/credit-cards.png"
          width={20}
          height={20}
          alt="account"
        />
        <p className="line-clamp-1 w-full text-left">
          {accounts.find((acc) => acc.appwriteItemId === selectedId)?.name || "Select a bank"}
        </p>
      </SelectTrigger>
      <SelectContent className={`w-full bg-white md:w-[300px] ${otherStyles}`} align="end">
        <SelectGroup>
          <SelectLabel className="py-2 font-normal text-black-3">
            Select a bank to display
          </SelectLabel>
          {accounts.map((account) => (
            <SelectItem
              key={account.appwriteItemId}  // Unique key using appwriteItemId
              value={account.appwriteItemId}  // Value is the appwriteItemId
              className={`cursor-pointer border-t ${selectedId === account.appwriteItemId ? 'bg-blue-100' : ''}`}  // Highlight selected item
            >
              <div className="flex flex-col">
                <p className="text-16 font-medium">{account.name}</p>
                <p className="text-143 font-medium">
                  {formatAmount(account.currentBalance)}
                </p>
              </div>
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
};
