import type { Metadata } from 'next';
import { Admin } from '@/components/Admin';

export const metadata: Metadata = {
  title: 'Admin console',
  description: 'Back-office for Video Subtitle Translator subscriptions.'
};

export default function AdminPage() {
  return <Admin />;
}
