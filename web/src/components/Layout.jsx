import { Outlet } from "react-router-dom";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { ScrollToHash } from "./ScrollToHash";

export function Layout() {
  return (
    <div className="flex min-h-screen flex-col bg-cream bg-grain">
      <ScrollToHash />
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
