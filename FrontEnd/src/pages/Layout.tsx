import React from "react";
import { Outlet } from "react-router";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

const Layout: React.FC = () => {
  return (
    <div className="w-full min-h-screen flex flex-col items-center bg-neutral-300 text-zinc-950 dark:bg-neutral-950 dark:text-white">
      <Navbar />

      <main className="grow w-full  py-4 px-2 md:px-0">
        {/* md:max-w-2xl */}
        <Outlet />
      </main>

      <Footer />
    </div>
  );
};

export default Layout;