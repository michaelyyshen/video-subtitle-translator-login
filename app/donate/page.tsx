import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Donate } from '@/components/Donate';

export const metadata: Metadata = {
  title: 'Support the project',
  description: 'Donations help keep the extension alive. They never unlock features — subscriptions do.'
};

export default function DonatePage() {
  return (
    <Suspense fallback={null}>
      <Donate />
    </Suspense>
  );
}
