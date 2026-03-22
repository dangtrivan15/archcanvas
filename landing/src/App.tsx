import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';

export function App() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main>
        <Hero />
        <section id="features" className="py-20 text-center">
          <h2 className="text-3xl font-extrabold text-dark-purple">Features placeholder</h2>
        </section>
      </main>
    </div>
  );
}
