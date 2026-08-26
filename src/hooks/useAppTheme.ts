import { useColorScheme } from "react-native";
import { Colors, type ThemeColors } from "@/constants/theme";

export function useAppTheme() {
  const systemScheme = useColorScheme();
  const isDark = systemScheme === "dark";
  const colors: ThemeColors = isDark ? Colors.dark : Colors.light;

  return {
    isDark,
    colors,
    colorScheme: isDark ? "dark" : "light",
    statusBarStyle: colors.statusBar,
  };
}
