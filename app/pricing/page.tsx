import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Pricing } from '@/components/Pricing';

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Pick a plan: monthly or yearly. Every paid plan unlocks the full Video Subtitle Translator extension.'
};

export default function PricingPage() {
  return (
    <Suspense fallback={null}>
      <Pricing />
    </Suspense>
  );
}
