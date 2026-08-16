"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";

import { createTransfer } from "@/lib/actions/dwolla.actions";
import { createTransaction } from "@/lib/actions/transaction.actions";
import { getBank, getBankByAccountId } from "@/lib/actions/user.actions";
import { decryptId } from "@/lib/utils";

import { BankDropdown } from "./BankDropdown";
import { Button } from "./ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./ui/form";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { toast } from 'sonner';

const formSchema = z.object({
  email: z.string().email("Invalid email address"),
  name: z.string().min(4, "Transfer note is too short"),
  amount: z.coerce.number().min(0.01, "Amount must be greater than 0"),
  senderBank: z.string().min(4, "Please select a valid bank account"),
  shareableId: z.string()
    .min(36, "Must be 36 characters")
    .max(36, "Must be 36 characters")
    .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/, 
      "Invalid UUID format")
});

interface PaymentTransferFormProps {
  accounts: Account[];
}

const PaymentTransferForm = ({ accounts }: PaymentTransferFormProps) => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      amount: 0,
      senderBank: "",
      shareableId: "",
    },
  });

  const submit = async (data: z.infer<typeof formSchema>) => {
    setIsLoading(true);
    setError(null);
    setSuccess(false);
  
    try {
      const sanitizedId = data.shareableId
        .trim()
        .toLowerCase()
        .replace(/[^a-f0-9-]/g, "");
  
      // Validate UUID format
      if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(sanitizedId)) {
        throw new Error("Invalid Shareable ID. Must be in UUID format");
      }
  
      const amount = parseFloat(data.amount.toFixed(2));
      if (isNaN(amount) || amount <= 0) {
        throw new Error("Amount must be greater than 0");
      }
  
      // Get both banks
      const [receiverBank, senderBank] = await Promise.all([
        // This will now search by either accountId or shareableId
        getBankByAccountId({ accountId: sanitizedId }),
        getBank({ documentId: data.senderBank }),
      ]);
  
      if (!receiverBank) {
        throw new Error("Receiver bank not found. Please check the Shareable ID.");
      }
  
      if (!senderBank) {
        throw new Error("Sender bank not found. Please verify your bank selection.");
      }
  
      if (!receiverBank.fundingSourceUrl || !senderBank.fundingSourceUrl) {
        throw new Error("Bank accounts not properly configured for transfers.");
      }
  
      // Rest of your transfer logic...
      const transferParams = {
        sourceFundingSourceUrl: senderBank.fundingSourceUrl,
        destinationFundingSourceUrl: receiverBank.fundingSourceUrl,
        amount: amount.toFixed(2),
      };
  
      const [transfer, newTransaction] = await Promise.all([
        createTransfer(transferParams),
        createTransaction({
          name: data.name,
          amount: amount,
          senderId: senderBank.userId.$id,
          senderBankId: senderBank.$id,
          receiverId: receiverBank.userId.$id,
          receiverBankId: receiverBank.$id,
          email: data.email,
        }),
      ]);
  
      if (!transfer || !newTransaction) {
        throw new Error("Transfer processing failed. Please try again later.");
      }

    toast.success('Transaction completed successfully!', {
      description: `$${amount.toFixed(2)} has been transferred.`,
      duration: 5000,
    });
    form.reset();
    setSuccess(true);
  
      setSuccess(true);
      form.reset();
    } catch (error) {
      console.error("Transfer error:", error);
      // Show error toast
      toast.error('Transfer failed', {
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
      });
      setError(
        error instanceof Error 
          ? error.message 
          : "An unexpected error occurred during transfer"
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submit)} className="flex flex-col">
        {error && (
          <div className="text-red-500 p-4 mb-4 border border-red-200 rounded">
            <h3 className="font-bold">Error:</h3>
            <p>{error}</p>
          </div>
        )}

        <FormField
          control={form.control}
          name="senderBank"
          render={() => (
            <FormItem className="border-t border-gray-200">
              <div className="payment-transfer_form-item pb-6 pt-5">
                <div className="payment-transfer_form-content">
                  <FormLabel className="text-14 font-medium text-gray-700">
                    Select Source Bank
                  </FormLabel>
                  <FormDescription className="text-12 font-normal text-gray-600">
                    Select the bank account you want to transfer funds from
                  </FormDescription>
                </div>
                <div className="flex w-full flex-col">
                  <FormControl>
                    <BankDropdown
                      accounts={accounts}
                      setValue={form.setValue}
                      otherStyles="!w-full"
                    />
                  </FormControl>
                  <FormMessage className="text-12 text-red-500" />
                </div>
              </div>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem className="border-t border-gray-200">
              <div className="payment-transfer_form-item pb-6 pt-5">
                <div className="payment-transfer_form-content">
                  <FormLabel className="text-14 font-medium text-gray-700">
                    Transfer Note (Optional)
                  </FormLabel>
                  <FormDescription className="text-12 font-normal text-gray-600">
                    Please provide any additional information or instructions
                  </FormDescription>
                </div>
                <div className="flex w-full flex-col">
                  <FormControl>
                    <Textarea
                      placeholder="Write a short note here"
                      className="input-class"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-12 text-red-500" />
                </div>
              </div>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem className="border-t border-gray-200">
              <div className="payment-transfer_form-item py-5">
                <FormLabel className="text-14 w-full max-w-[280px] font-medium text-gray-700">
                  Recipient Email Address
                </FormLabel>
                <div className="flex w-full flex-col">
                  <FormControl>
                    <Input
                      placeholder="johndoe@gmail.com"
                      className="input-class"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-12 text-red-500" />
                </div>
              </div>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="shareableId"
          render={({ field }) => {
            const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
              const cursorPosition = e.target.selectionStart;
              let value = e.target.value.toLowerCase();
              value = value.replace(/[^a-f0-9-]/g, '');
              
              // Auto-format UUID
              if (value.length > 8 && value[8] !== '-') value = `${value.slice(0, 8)}-${value.slice(8)}`;
              if (value.length > 13 && value[13] !== '-') value = `${value.slice(0, 13)}-${value.slice(13)}`;
              if (value.length > 18 && value[18] !== '-') value = `${value.slice(0, 18)}-${value.slice(18)}`;
              if (value.length > 23 && value[23] !== '-') value = `${value.slice(0, 23)}-${value.slice(23)}`;
              
              field.onChange(value.slice(0, 36));
              
              // Maintain cursor position
              setTimeout(() => {
                if (e.target.selectionStart !== cursorPosition) {
                  e.target.setSelectionRange(cursorPosition, cursorPosition);
                }
              }, 0);
            };

            return (
              <FormItem className="border-t border-gray-200">
                <div className="payment-transfer_form-item pb-5 pt-6">
                  <FormLabel className="text-14 w-full max-w-[280px] font-medium text-gray-700">
                    Receiver's Shareable Id
                  </FormLabel>
                  <div className="flex w-full flex-col">
                    <FormControl>
                      <Input
                        placeholder="00000000-0000-0000-0000-000000000000"
                        className="input-class"
                        value={field.value}
                        onChange={handleChange}
                        onBlur={field.onBlur}
                      />
                    </FormControl>
                    <FormMessage className="text-12 text-red-500" />
                  </div>
                </div>
              </FormItem>
            );
          }}
        />

        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem className="border-y border-gray-200">
              <div className="payment-transfer_form-item py-5">
                <FormLabel className="text-14 w-full max-w-[280px] font-medium text-gray-700">
                  Transfer Amount
                </FormLabel>
                <div className="flex w-full flex-col">
                  <FormControl>
                    <Input
                      placeholder="0.00"
                      type="number"
                      step="0.01"
                      min="0.01"
                      className="input-class"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-12 text-red-500" />
                </div>
              </div>
            </FormItem>
          )}
        />

        <div className="payment-transfer_btn-box">
          <Button 
            type="submit" 
            className="payment-transfer_btn"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 size={20} className="animate-spin" /> Sending...
              </>
            ) : (
              "Transfer Funds"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default PaymentTransferForm;