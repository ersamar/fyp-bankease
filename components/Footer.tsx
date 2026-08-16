import { logoutAccount } from '@/lib/actions/user.actions';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import React from 'react';
import { toast } from 'sonner';

interface FooterProps {
  user: {
    firstName: string;
    email: string;
  };
  type?: 'mobile' | 'desktop';
}

const Footer = ({ user, type = 'desktop' }: FooterProps) => {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      // Clear client-side state immediately
      if (typeof window !== 'undefined') {
        localStorage.removeItem('authState');
      }

      // Initiate logout
      await logoutAccount();
      toast.success('Logged out successfully');
      router.push('/sign-in');
    } catch (error) {
      toast.error('Logout failed. Please try again.');
    }
  };

  return (
    <footer className="footer">
      <div className={type === 'mobile' ? 'footer_name-mobile' : 'footer_name'}>
        <p className="text-xl font-bold text-gray-700">
          {user?.firstName[0]}
        </p>
      </div>

      <div className={type === 'mobile' ? 'footer_email-mobile' : 'footer_email'}>
        <h1 className="text-14 truncate text-gray-700 font-semibold">
          {user?.firstName}
        </h1>
        <p className="text-14 truncate font-normal text-gray-600">
          {user?.email}
        </p>
      </div>

      <div className="footer_image" onClick={handleLogout}>
        <Image 
          src="/icons/logout.png" 
          fill 
          alt="Logout" 
        />
      </div>
    </footer>
  );
};

export default Footer;