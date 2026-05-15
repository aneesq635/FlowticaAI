import React, { useState } from "react";
import { View, Text, TouchableOpacity, useWindowDimensions, Modal, Image } from "react-native";
import { useRouter, usePathname } from "expo-router";
import { useAuth } from "./AuthContext.js";
import { ChevronDown, Sun, Moon, Menu, X, LogOut } from "lucide-react-native";

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();   
  const { width } = useWindowDimensions();
  
  // React Native handles styling dynamically using State
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useState("light"); // Assuming state theme toggle for Expo
  const isDesktop = width >= 1024;
  
  const navLinks = [{ label: "Home", href: "/" },
    { label: "About", href: "/about" },
  ];

  return (
    <>
      <View className="w-full bg-white dark:bg-[#0a0a0a] border-b border-gray-100 dark:border-white/5 z-50">
        <View className="flex-row justify-between items-center h-16 px-4 md:px-8 max-w-7xl mx-auto">
          
          <TouchableOpacity onPress={() => router.push("/")}>
            <Text className="font-bold text-xl tracking-tight text-black dark:text-white">
              Flowtica <Text className="text-gray-500">AI</Text>
            </Text>
          </TouchableOpacity>

          {/* Desktop Nav */}
          {isDesktop && (
            <View className="flex-row items-center gap-1 absolute left-1/2 -ml-10">
              {navLinks.map(({ label, href }) => (
                <TouchableOpacity
                  key={href}
                  onPress={() => router.push(href)}
                  className={`px-4 py-2 rounded-xl ${pathname === href ? "bg-black" : ""}`}
                >
                  <Text className={`text-sm font-medium ${pathname === href ? "text-white" : "text-gray-600"}`}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View className="flex-row items-center gap-2">
            <TouchableOpacity 
              onPress={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="w-9 h-9 rounded-xl flex items-center justify-center bg-gray-50 border border-gray-200"
            >
              {theme === "dark" ? <Moon size={15} color="#818cf8" /> : <Sun size={15} color="#f59e0b" />}
            </TouchableOpacity>

            {isDesktop ? (
              user ? (
                 <TouchableOpacity onPress={logout} className="ml-2 bg-red-50 p-2 rounded-xl">
                   <LogOut size={16} color="red" />
                 </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={() => router.push("/auth")}>
                  <Text className="text-sm font-medium text-gray-600 ml-2">Login/Signup</Text>
                </TouchableOpacity>
              )
            ) : (
              <TouchableOpacity onPress={() => setMobileOpen(true)} className="w-9 h-9 rounded-xl flex items-center justify-center bg-gray-50 border border-gray-200">
                <Menu size={18} color="black" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* Mobile Modal Drawer */}
      <Modal visible={mobileOpen} animationType="slide" transparent={true}>
        <View className="flex-1 bg-black/50 justify-end">
           <View className="h-full w-72 bg-white absolute right-0 shadow-2xl p-5">
             <View className="flex-row justify-between items-center mb-6">
                <Text className="font-bold text-lg text-black">Menu</Text>
                <TouchableOpacity onPress={() => setMobileOpen(false)}>
                  <X size={20} color="black" />
                </TouchableOpacity>
             </View>
             
             {/* Nav Links */}
             {navLinks.map((link) => (
                <TouchableOpacity key={link.href} onPress={() => { router.push(link.href); setMobileOpen(false); }} className="py-3">
                  <Text className="text-base text-gray-700 font-medium">{link.label}</Text>
                </TouchableOpacity>
             ))}

             <View className="mt-auto border-t border-gray-100 pt-4">
                {user ? (
                  <TouchableOpacity onPress={logout} className="flex-row items-center gap-3 py-3 rounded-xl bg-red-50 px-4">
                    <LogOut size={15} color="red" />
                    <Text className="text-red-600 font-medium">Sign out</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={() => { router.push("/auth"); setMobileOpen(false); }} className="w-full bg-black py-3 rounded-xl items-center">
                    <Text className="text-white font-semibold">Login / Signup</Text>
                  </TouchableOpacity>
                )}
             </View>
           </View>
        </View>
      </Modal>
    </>
  );
}
