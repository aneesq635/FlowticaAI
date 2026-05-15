import React, { useState } from "react";

import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";

import { useLocalSearchParams, useRouter } from "expo-router";

export default function Onboarding() {
  const router = useRouter();

  const { supabase_id, email } =
    useLocalSearchParams();

  const [selected, setSelected] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const createUser = async () => {
    try {
      setLoading(true);

      const response = await fetch(
        "http://192.168.0.102:5000/create-user",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            supabase_id,
            email,
            user_type: selected,
          }),
        }
      );

      const data = await response.json();

      console.log(data);

      Alert.alert(
        "Success",
        "User created"
      );

      router.replace("/");
    } catch (error) {
      console.log(error);

      Alert.alert(
        "Error",
        error.message
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 justify-center px-6 bg-white">
      <Text className="text-3xl font-bold mb-2">
        Choose Account Type
      </Text>

      <Text className="text-gray-500 mb-8">
        Select how you want to use the app
      </Text>

      <TouchableOpacity
        onPress={() =>
          setSelected("customer")
        }
        className={`p-5 rounded-2xl mb-4 border ${
          selected === "customer"
            ? "border-black bg-black"
            : "border-gray-300"
        }`}
      >
        <Text
          className={`text-lg font-semibold ${
            selected === "customer"
              ? "text-white"
              : "text-black"
          }`}
        >
          Customer
        </Text>

        <Text
          className={`mt-1 ${
            selected === "customer"
              ? "text-gray-300"
              : "text-gray-500"
          }`}
        >
          Book services
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() =>
          setSelected("provider")
        }
        className={`p-5 rounded-2xl border ${
          selected === "provider"
            ? "border-black bg-black"
            : "border-gray-300"
        }`}
      >
        <Text
          className={`text-lg font-semibold ${
            selected === "provider"
              ? "text-white"
              : "text-black"
          }`}
        >
          Provider
        </Text>

        <Text
          className={`mt-1 ${
            selected === "provider"
              ? "text-gray-300"
              : "text-gray-500"
          }`}
        >
          Offer services
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        disabled={!selected || loading}
        onPress={createUser}
        className="bg-black py-4 rounded-2xl mt-8 items-center"
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-white font-semibold">
            Continue
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}