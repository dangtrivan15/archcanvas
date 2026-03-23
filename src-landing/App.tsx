import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { Features } from './components/Features';
import { HowItWorks } from './components/HowItWorks';
import { TechStrip } from './components/TechStrip';
import { CtaSection } from './components/CtaSection';
import { Footer } from './components/Footer';

export function App() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <TechStrip />
        <CtaSection />
      </main>
      <Footer />
    </div>
  );
}
