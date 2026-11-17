import { MongoClient, ServerApiVersion } from "mongodb";
import { pathToFileURL } from "node:url";

const DEFAULT_DB_NAME = "blending";
const POLICY_KEY = "mobile_version_policy";
const DEFAULT_MESSAGE =
  "안정적인 서비스 이용을 위해 최신 버전으로 업데이트해 주세요.";

type Platform = "android" | "ios";

type ParsedArgs = {
  builds: Partial<Record<Platform, number>>;
};

function readFlagValue(args: string[], flag: string) {
  const index = args.indexOf(flag);
  if (index === -1) return null;

  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value.`);
  }

  return value;
}

function parseBuildNumber(value: string | null, label: string) {
  if (value === null) return null;

  const buildNumber = Number.parseInt(value, 10);
  if (!Number.isInteger(buildNumber) || buildNumber <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }

  return buildNumber;
}

function parseArgs(args: string[]): ParsedArgs {
  const platform = readFlagValue(args, "--platform");
  const buildNumber = parseBuildNumber(
    readFlagValue(args, "--build-number"),
    "--build-number",
  );
  const androidBuildNumber = parseBuildNumber(
    readFlagValue(args, "--android-build-number") ??
      process.env.ANDROID_LATEST_BUILD_NUMBER ??
      null,
    "--android-build-number",
  );
  const iosBuildNumber = parseBuildNumber(
    readFlagValue(args, "--ios-build-number") ??
      process.env.IOS_LATEST_BUILD_NUMBER ??
      null,
    "--ios-build-number",
  );

  if (platform !== null) {
    if (platform !== "android" && platform !== "ios") {
      throw new Error("--platform must be android or ios.");
    }

    if (buildNumber === null) {
      throw new Error("--build-number is required with --platform.");
    }

    return { builds: { [platform]: buildNumber } };
  }

  const builds: Partial<Record<Platform, number>> = {};
  if (androidBuildNumber !== null) builds.android = androidBuildNumber;
  if (iosBuildNumber !== null) builds.ios = iosBuildNumber;

  if (!builds.android && !builds.ios) {
    throw new Error(
      "Provide --platform/--build-number, --android-build-number, --ios-build-number, or matching environment variables.",
    );
  }

  return { builds };
}

function mongoUri() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI environment variable is required.");
  return uri;
}

function latestBuildPath(platform: Platform) {
  return `${platform}.latestBuildNumber`;
}

export function versionPolicyUpdate(
  builds: Partial<Record<Platform, number>>,
  now = new Date(),
) {
  return {
    $max: Object.fromEntries(
      Object.entries(builds).map(([platform, buildNumber]) => [
        latestBuildPath(platform as Platform),
        buildNumber,
      ]),
    ),
    $inc: { revision: 1 },
    $set: {
      _updatedAt: now,
      updatedAt: now.toISOString(),
      updatedBy: "eas-version-sync",
    },
    $setOnInsert: {
      key: POLICY_KEY,
      enabled: false,
      message: DEFAULT_MESSAGE,
      "android.minBuildNumber": null,
      "android.updateUrl": null,
      "ios.minBuildNumber": null,
      "ios.updateUrl": null,
      _createdAt: now,
    },
  };
}

async function main() {
  const { builds } = parseArgs(process.argv.slice(2));
  const client = new MongoClient(mongoUri(), {
    appName: "blending-version-policy-sync",
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  });

  await client.connect();

  try {
    const db = client.db(process.env.MONGODB_DB ?? DEFAULT_DB_NAME);
    const result = await db
      .collection("app_configs")
      .updateOne({ key: POLICY_KEY }, versionPolicyUpdate(builds), {
        upsert: true,
      });

    console.log(
      JSON.stringify(
        {
          ok: true,
          matchedCount: result.matchedCount,
          modifiedCount: result.modifiedCount,
          upsertedId: result.upsertedId ?? null,
          latestBuildNumber: builds,
        },
        null,
        2,
      ),
    );
  } finally {
    await client.close();
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url)
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
