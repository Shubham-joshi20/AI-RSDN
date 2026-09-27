import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router";
import { motion } from "framer-motion";
import { FaGithub } from "react-icons/fa";

const Navbar: React.FC = () => {
  const nav = useNavigate();
  const location = useLocation();

  const menuItems = ["Showcase", "Visualization", "Algorithm", "About"];

  const getActiveIndex = () => {
    if (location.pathname === "/") return 0;
    const currentIndex = menuItems.findIndex((item) =>
      location.pathname.includes(item.toLowerCase())
    );
    return currentIndex !== -1 ? currentIndex : 0;
  };

  const [activeIndex, setActiveIndex] = useState(getActiveIndex());

  useEffect(() => {
    setActiveIndex(getActiveIndex());
  }, [location.pathname]);

  return (
    <nav className="w-full px-4 z-10 backdrop-blur-xs flex justify-between items-center py-3 text-xl font-semibold sticky top-0 ">
      <div>
        <button onClick={() => nav("/")} className="cursor-pointer text-2xl mx-2">
          AI-RSDN
        </button>
      </div>

      <div className="absolute ml-2  sm:relative top-14 sm:top-0 flex gap-3 px-4 justify-center items-center">
        <motion.div
          className={`absolute ml-4 bottom-0 overflow-hidden h-px bg-linear-to-r from-gray-500/10 via-blue-700/80 to-gray-500/10 ${
            activeIndex === 0 ? "px-1 ml-6" : ""
          } ${activeIndex === 1 ? "ml-1" : ""} ${
            activeIndex === 3 ? "px-1 ml-0" : ""
          } ${
            activeIndex === 2 ? "pr-2" : ""
          }
          `}
          initial={false}
          animate={{
            left: `${activeIndex * 27}%`,
          }}
          transition={{ type: "spring", stiffness: 450, damping: 45 }}
        >
          {menuItems[activeIndex]}
        </motion.div>
        {menuItems.map((item, index) => {
          const path = index === 0 ? "/" : `/${item.toLowerCase()}`;
          const isActive = location.pathname === path;

          return (
            <div
              key={index}
              className="relative group p-1 flex justify-center items-between"
            >
              <button
                className={`cursor-pointer text-2xl font-thin transition-colors duration-200 ${
                  isActive
                    ? "text-blue-600 font-semibold "
                    : "group-hover:text-blue-700"
                } `}
                onClick={() => {
                  nav(path);
                  setActiveIndex(index);
                }}
              >
                {item}
              </button>
            </div>
          );
        })}
      </div>

      <div className="">
        <a
          href="https://github.com/hashnj/AI-RSDN"
          target="_blank"
          className="text-2xl cursor-pointer"
        >
          <FaGithub />
        </a>
      </div>
    </nav>
  );
};

export default Navbar;