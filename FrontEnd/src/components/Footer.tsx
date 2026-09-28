import React, { useEffect, useState } from "react";
import useTheme from "../hooks/useTheme";
import { MdOutlineDarkMode } from "react-icons/md";
import { CiDesktop, CiLight } from "react-icons/ci";
// import { FaGithub, FaLinkedin } from "react-icons/fa";
// import { FaXTwitter } from "react-icons/fa6";
import { motion } from "framer-motion";

const themeOrder = ["light", "dark", "system"] as const;

const Footer: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(themeOrder.indexOf(theme));
  }, [theme]);

  return (
    <footer className="w-full min-h-28 flex items-center justify-between px-10 border-t border-zinc-100/30">
      <div className="text-lg font-semibold cursor-default my-3">
        <div>
        <span
          className="cursor-pointer text-xl font-bold"
        >
          Advance Algorithm Minor Project
        </span>
        <span className="text-zinc-500 text-sm px-1">-</span>
        <span className="text-black/40 dark:text-zinc-400 text-base">
          AI-RSDN
        </span>
        </div>
        <div className="text-black/40 dark:text-zinc-400 text-base flex ">
            <div>Team - </div>
            <div className="flex flex-col text-black/50 dark:text-zinc-300 ">
                <span
                    onClick={()=> window.open("https://github.com/Shubham-joshi20")}
                    className="cursor-pointer font-bold pl-1 hover:dark:text-zinc-200 hover:text-black/70"
                >Shubham Joshi,</span>
                <span
                    onClick={()=> window.open("https://github.com/Shubham-joshi20")}
                    className="cursor-pointer font-bold pl-1 hover:dark:text-zinc-200 hover:text-black/70"
                >Nikhilesh Joshi,</span>
                <span
                    onClick={()=> window.open("https://github.com/Nikhilbanasal22")}
                    className="cursor-pointer font-bold pl-1 hover:dark:text-zinc-200 hover:text-black/70"
                >Nikhil Bansal,</span>
                <span
                    onClick={()=> window.open("https://github.com/Shubham-joshi20")}
                    className="cursor-pointer font-bold pl-1 hover:dark:text-zinc-200 hover:text-black/70"
                >Amit Nishad.</span>
            </div> 
        </div>
      </div>

      {/* <div className="flex gap-5 text-xl">
        <a
          href="https://github.com/hashnj/AI-RSDN"
          target="_blank"
          rel="noreferrer"
          className="cursor-pointer hover:text-blue-500"
        >
          <FaGithub />
        </a>
        
      </div> */}

      <div className="relative border border-zinc-300/20 rounded-full py-1 px-3  flex items-center">
        <motion.div
          className="absolute  gap-1 bg-zinc-500/40 rounded-full p-3"
          initial={false}
          animate={{ x: activeIndex * 24 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
        />
        {themeOrder.map((mode, index) => (
          <button
            key={mode}
            className={`relative cursor-pointer hover:bg-zinc-400/30 rounded-full p-1 z-10`}
            onClick={() => {
              setTheme(mode as "light" | "dark" | "system");
              setActiveIndex(index);
            }}
            aria-label={`${mode} Mode`}
          >
            {mode === "light" ? (
              <CiLight />
            ) : mode === "dark" ? (
              <MdOutlineDarkMode />
            ) : (
              <CiDesktop />
            )}
          </button>
        ))}
      </div>
    </footer>
  );
};

export default Footer;