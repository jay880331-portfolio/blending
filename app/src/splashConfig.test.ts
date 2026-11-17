import appConfigJson from "../app.json" with { type: "json" };

const appConfig = appConfigJson as {
  expo: {
    plugins: (string | [string, Record<string, unknown>])[];
  };
};
const splashPlugin = appConfig.expo.plugins.find(
  (plugin) => Array.isArray(plugin) && plugin[0] === "expo-splash-screen",
);

if (!Array.isArray(splashPlugin)) {
  throw new Error("Expected expo-splash-screen configuration");
}

const splashOptions = splashPlugin[1];

if (splashOptions.backgroundColor !== "#FFFFFF") {
  throw new Error("Expected a white native splash background");
}

if ("image" in splashOptions) {
  throw new Error("Native splash must not render a branded image");
}
