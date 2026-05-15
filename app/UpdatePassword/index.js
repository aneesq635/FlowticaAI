import React, {
  useEffect,
  useState,
} from "react";

import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  Alert,
} from "react-native";

import * as Linking from "expo-linking";

import supabase from "../../components/Supabase";

export default function UpdatePassword() {
  const [password,
    setPassword] =
    useState("");

  useEffect(() => {
    handleDeepLink();

    const subscription =
      Linking.addEventListener(
        "url",
        handleDeepLink
      );

    return () => {
      subscription.remove();
    };
  }, []);

  const handleDeepLink =
    async (event) => {
      const url =
        event?.url ||
        (await Linking.getInitialURL());

      if (!url) return;

      const parsed =
        Linking.parse(url);

      const access_token =
        parsed.queryParams
          ?.access_token;

      const refresh_token =
        parsed.queryParams
          ?.refresh_token;

      if (
        access_token &&
        refresh_token
      ) {
        await supabase.auth.setSession(
          {
            access_token,
            refresh_token,
          }
        );
      }
    };

  const updatePassword =
    async () => {
      const { error } =
        await supabase.auth.updateUser(
          {
            password,
          }
        );

      if (error) {
        Alert.alert(
          "Error",
          error.message
        );
      } else {
        Alert.alert(
          "Success",
          "Password updated"
        );
      }
    };

  return (
    <View className="flex-1 justify-center px-6 bg-white">
      <TextInput
        placeholder="New Password"
        secureTextEntry
        value={password}
        onChangeText={
          setPassword
        }
        className="border border-gray-300 rounded-xl p-4 mb-4"
      />

      <TouchableOpacity
        onPress={
          updatePassword
        }
        className="bg-black p-4 rounded-xl"
      >
        <Text className="text-white text-center font-semibold">
          Update Password
        </Text>
      </TouchableOpacity>
    </View>
  );
}