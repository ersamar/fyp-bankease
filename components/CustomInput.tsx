import React from 'react';
import { FormControl, FormField, FormLabel, FormMessage } from './ui/form';
import { Input, InputProps } from './ui/input';
import { Control, FieldPath, FieldValues } from 'react-hook-form';
import { z } from 'zod';
import { authFormSchema } from '@/lib/utils';

// Create a generic type for your form schema
type FormValues = z.infer<ReturnType<typeof authFormSchema>>;

interface CustomInputProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  placeholder: string;
  type?: InputProps['type'];
}

const CustomInput = <T extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  type = name === 'password' || name === 'confirmPassword' ? 'password' : 'text'
}: CustomInputProps<T>) => {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <div className="form-item">
          <FormLabel className="form-label">
            {label}
          </FormLabel>
          <div className="flex w-full flex-col">
            <FormControl>
              <Input 
                placeholder={placeholder}
                className="input-class"
                type={type}
                {...field}
                name={name as string} // Explicitly cast to string to satisfy InputProps
              />
            </FormControl>
            <FormMessage className="form-message mt-2" />
          </div>
        </div>
      )}
    />
  );
};

export default CustomInput;