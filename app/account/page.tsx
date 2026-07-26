import type { Metadata } from 'next';
import { Account } from '@/components/Account';

export const metadata: Metadata = {
  title: 'Your account',
  description: 'Manage your Video Subtitle Translator subscription, billing, and account details.'
};

export default function AccountPage() {
  return <Account />;
}
