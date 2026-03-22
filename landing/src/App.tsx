import { Navbar } from './components/Navbar';

export function App() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main>
        <section id="hero" className="py-20 text-center">
          <h1 className="text-4xl font-extrabold text-dark-purple">Hero section placeholder</h1>
        </section>
        <section id="features" className="py-20 text-center">
          <h2 className="text-3xl font-extrabold text-dark-purple">Features placeholder</h2>
        </section>
      </main>
    </div>
  );
}
