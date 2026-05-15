import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, useWindowDimensions, Modal, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, usePathname } from "expo-router";
import { useAuth } from "./AuthContext.js";
import { ChevronDown, Sun, Moon, Menu, X, LogOut, UserCircle } from "lucide-react-native";

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { width } = useWindowDimensions();
  const [dbUser, setDbUser] =
    useState(null);
  // React Native handles styling dynamically using State
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useState("light"); // Assuming state theme toggle for Expo
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [isUpdatingType, setIsUpdatingType] = useState(false);

  const toggleUserType = async () => {
    if (!user?.id || !dbUser) return;
    try {
      setIsUpdatingType(true);
      const newType = dbUser.user_type === 'buyer' ? 'seller' : 'buyer';
      const res = await fetch("http://192.168.0.102:5000/update-user", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supabase_id: user.id,
          user_type: newType
        })
      });
      const data = await res.json();
      if (data.success) {
        setDbUser({ ...dbUser, user_type: newType });
        setConfirmModalOpen(false);
      } else {
        alert("Failed to update user type");
      }
    } catch (err) {
      console.log(err);
      alert("Error updating user type");
    } finally {
      setIsUpdatingType(false);
    }
  };
  const isDesktop = width >= 1024;

  const navLinks = [{ label: "Home", href: "/" },
  { label: "About", href: "/about" },
  ];
  const fetchUser =
    async () => {
      try {
        if (!user?.id)
          return;

        const response =
          await fetch(
            `http://192.168.0.102:5000/user/${user.id}`
          );

        const data =
          await response.json();

        if (data?.user) {
          setDbUser(
            data.user
          );
        }
      } catch (err) {
        console.log(err);
      }
    }; useEffect(() => {
      fetchUser();
    }, [user]);

  return (
    <>
      <SafeAreaView edges={['top']} className="w-full bg-white dark:bg-[#0a0a0a] border-b border-gray-100 dark:border-white/5 z-50">
        <View className="flex-row justify-between items-center h-16 px-4 md:px-8 max-w-7xl mx-auto gap-25">

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
      </SafeAreaView>

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

            {/* show user name and pic here if user logged in */}

            {user && dbUser && (
              <TouchableOpacity onPress={() => setConfirmModalOpen(true)} className="py-3 mt-2 bg-gray-50 rounded-xl px-4 border border-gray-200">
                <Text className="text-base text-gray-800 font-medium text-center">
                  Switch to {dbUser.user_type === 'buyer' ? 'Seller' : 'Buyer'} View
                </Text>
              </TouchableOpacity>
            )}

            <View className="mt-auto border-t border-gray-100 pt-4">
              {user && (
                <View className="flex-row items-center gap-3 py-3">

                  <View className="flex-1">
                    <Text className="text-base text-gray-800 font-semibold">
                      Profile
                    </Text>

                    <Text className="text-sm text-gray-500">
                      {dbUser?.email}
                    </Text>

                    <Text className="text-xs text-black mt-1 capitalize">
                      {
                        dbUser?.user_type
                      }
                    </Text>
                  </View>
                </View>
              )}
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

      {/* Confirm Type Change Modal */}
      <Modal visible={confirmModalOpen} animationType="fade" transparent={true}>
        <View className="flex-1 bg-black/50 justify-center items-center p-4">
          <View className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-xl">
            <Text className="text-xl font-bold text-gray-900 mb-2">Change User Type</Text>
            <Text className="text-gray-600 mb-6">
              Are you sure you want to switch to {dbUser?.user_type === 'buyer' ? 'Seller' : 'Buyer'} view?
            </Text>
            
            <View className="flex-row justify-end gap-3">
              <TouchableOpacity 
                onPress={() => setConfirmModalOpen(false)}
                className="px-4 py-2 rounded-xl"
                disabled={isUpdatingType}
              >
                <Text className="text-gray-600 font-medium">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={toggleUserType}
                className="bg-black px-4 py-2 rounded-xl"
                disabled={isUpdatingType}
              >
                <Text className="text-white font-medium">{isUpdatingType ? "Updating..." : "Confirm"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
