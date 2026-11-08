import React from "react";
import { Outlet, useLocation } from "react-router";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

const Layout: React.FC = () => {
  const { pathname } = useLocation();
  const campusPage = pathname === "/" || pathname === "/campus-demo";
  return (
    <div className={`flex min-h-screen w-full flex-col items-center ${campusPage ? "bg-[#081315] text-slate-100" : "bg-neutral-300 text-zinc-950 dark:bg-neutral-950 dark:text-white"}`}>
      <Navbar />

      <main className={`w-full grow ${campusPage ? "bg-[#081315] py-1" : "px-2 py-4 md:px-0"}`}>
        {/* md:max-w-2xl */}
        <Outlet />
      </main>

      {!campusPage && <Footer />}
    </div>
  );
};

export default Layout;
