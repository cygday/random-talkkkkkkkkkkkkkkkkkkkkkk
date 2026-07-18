import React, { useState } from "react";

import {
  View,
  Text,
  Switch
} from "react-native";

export default function SettingsScreen() {

  const [darkMode, setDarkMode] =
    useState(false);

  const [sound, setSound] =
    useState(true);

  return (
    <View style={{ padding: 20 }}>

      <Text>Dark Mode</Text>

      <Switch
        value={darkMode}
        onValueChange={setDarkMode}
      />

      <Text>Sound</Text>

      <Switch
        value={sound}
        onValueChange={setSound}
      />

    </View>
  );
}
