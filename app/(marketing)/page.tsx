import { HeroSection } from '@/components/marketing/hero-section';
import { FeaturesSection } from '@/components/marketing/features-section';
import { HowItWorksSection } from '@/components/marketing/how-it-works-section';
import { CTASection } from '@/components/marketing/cta-section';

export default function HomePage() {
  return (
    <div className="bg-white">
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <CTASection />
    </div>
  );
}
