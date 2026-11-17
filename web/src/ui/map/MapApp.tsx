"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  LocateFixed,
  LoaderCircle,
  Search,
  UserRound,
  X,
} from "lucide-react";
import type { MemberRole, PortfolioItem } from "@/domain/member/types";

import { isNativeBridgeAvailable, nativeBridge } from "@/bridge/nativeBridge";
import {
  BARISTA_SPECIALTIES,
  normalizeDefaultBaristaSpecialties,
  type BaristaSpecialty,
} from "@/domain/member/specialties";
import { useMemberStore } from "@/store/memberStore";
import {
  advanceBaristaDirectoryRandomWindowStart,
  buildBaristaDirectorySections,
  createBaristaDirectoryShuffleState,
  getBaristaDirectoryInitial,
  getDirectoryMatchedWorkplace,
  getDirectoryProfileHref,
  getHorizontalScrollIndicatorGeometry,
  matchesMapSearch,
  orderBaristaDirectoryProfiles,
  reconcileBaristaDirectoryShuffleState,
  rotateBaristaDirectoryProfiles,
  type BaristaDirectoryShuffleState,
} from "@/ui/map/mapDirectory";
import {
  MAP_CLUSTER_ZOOM_THRESHOLD,
  buildMapMarkerGroups,
  selectMapMarkerRepresentative,
  type MapMarkerGroup,
} from "@/ui/map/mapMarkerGroups";
import {
  profileClusterMarkerContent,
  profileMarkerContent,
  userLocationMarkerContent,
} from "@/ui/map/mapMarkerPresentation";
import {
  findOpenedMapBarista,
  findSearchedMapBaristaLocation,
  findUniqueSearchedMapProfile,
  profilesForMapMarkers,
  resolveOpenedMapProfile,
  shouldCenterMapForLocationRequest,
  shouldShowMapEmptyState,
  type MapLocationRequestIntent,
} from "@/ui/map/mapViewportState";
import {
  canShowMapMessageAction,
  type LocationStatus,
} from "@/ui/map/locationPermission";
import {
  loadNaverMaps,
  naverLogoControlOptions,
  type NaverMapInstance,
  type NaverMarkerInstance,
} from "@/ui/shared/naverMap";
import { Avatar } from "@/ui/shared/Avatar";
import { BottomNav } from "@/ui/shared/BottomNav";
import { stopGlobalLoading } from "@/ui/shared/GlobalLoadingBar";
import { HeaderIconActions } from "@/ui/shared/HeaderIconActions";
import { listenForBlockedUser } from "@/ui/shared/blockedUserEvent";
import { MapProfileGroupSheet } from "@/ui/map/MapProfileGroupSheet";
import { MapProfileDetailSheet } from "@/ui/map/MapProfileDetailSheet";
import {
  MapStoreSheet,
  type MapStoreSheetTimesale,
} from "@/ui/map/MapStoreSheet";
import { MapSearchBar } from "@/ui/map/MapSearchBar";
import { MapLocationButton } from "@/ui/map/MapLocationButton";
import {
  toggleStoreFavorite,
  updateLastLocation,
} from "@/adapters/http/showroomApi";
import { matchShowroomToPlace } from "@/domain/map/placeGrouping";
import {
  PASSPORT_MAP_TAGS,
  storeMatchesTagFilters,
  type PassportMapTag,
} from "@/domain/passport/match";
import type {
  CoffeePassport,
  StoreTasteProfile,
} from "@/domain/passport/passport";
import type { ShowroomStatusNotice } from "@/domain/showroom/statusNotice";
import type { ShowroomLocation } from "@/domain/showroom/types";
import { Chip } from "@/ui/shared/Chip";

type NearbyProfile = {
  id: string;
  profileId: string;
  name: string;
  workplace: string;
  address: string;
  avatarUrl?: string;
  online: boolean;
  role: MemberRole;
  handle: string;
  bio: string;
  favoriteCount: number;
  favorited: boolean;
  canMessage: boolean;
  isOwnProfile: boolean;
  isPortfolioPublic: boolean;
  portfolios: PortfolioItem[];
  skills: BaristaSpecialty[];
  lat: number;
  lng: number;
};

type DirectoryProfile = Pick<
  NearbyProfile,
  | "id"
  | "profileId"
  | "name"
  | "workplace"
  | "avatarUrl"
  | "role"
  | "handle"
  | "skills"
> & {
  workplaces: string[];
  addresses: string[];
  bio: string;
  lat?: number;
  lng?: number;
  badgeName?: string;
};

type MapStore = {
  id: string;
  userId: string;
  storeName: string;
  location?: ShowroomLocation;
  avatarUrl?: string;
  statusNotice?: ShowroomStatusNotice;
  tasteProfile?: StoreTasteProfile;
  favorited: boolean;
  stampCount?: number;
  canRedeem?: boolean;
  hasActiveBeans?: boolean;
  businessVerified?: boolean;
  activeTimesaleCoupons: MapStoreSheetTimesale[];
};

type MapProfilesResponse = {
  profiles: Array<{
    id: string;
    profileId: string;
    name: string;
    workplace: string;
    address: string;
    avatarUrl?: string;
    online: boolean;
    role: MemberRole;
    handle: string;
    bio: string;
    favoriteCount: number;
    favorited: boolean;
    canMessage: boolean;
    isOwnProfile: boolean;
    isPortfolioPublic: boolean;
    portfolios: PortfolioItem[];
    skills: string[];
    lat: number;
    lng: number;
  }>;
  stores?: MapStore[];
  viewerPassport?: CoffeePassport | null;
};

type DirectoryProfilesResponse = {
  profiles: Array<{
    profileId: string;
    name: string;
    workplace: string;
    workplaces: string[];
    addresses: string[];
    bio: string;
    avatarUrl?: string;
    role: MemberRole;
    handle: string;
    skills: string[];
    badgeName?: string;
  }>;
};

type UserLocation = {
  lat: number;
  lng: number;
};

type LocationPermissionContext = {
  source: "native" | "browser";
  canAskAgain?: boolean;
};

type LocationRequestSource = LocationPermissionContext["source"];

type LocationRequestOptions = {
  showFailureModal?: boolean;
};

const NAVER_MAP_KEY_ID =
  process.env.NEXT_PUBLIC_NAVER_MAP_KEY_ID ??
  process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;

const MAX_TRUSTED_LOCATION_ACCURACY_METERS = 500;
const LAST_USER_LOCATION_STORAGE_KEY = "blending:last-user-location";
const LAST_USER_LOCATION_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const BROWSER_LOCATION_STUCK_TIMEOUT_MS = 8_000;
const NATIVE_LOCATION_STUCK_TIMEOUT_MS = 30_000;
const DIRECTORY_SHUFFLE_STORAGE_PREFIX = "blending:barista-directory-shuffle:";
const DIRECTORY_INITIAL_FILTERS = [
  "전체",
  "ㄱ",
  "ㄴ",
  "ㄷ",
  "ㄹ",
  "ㅁ",
  "ㅂ",
  "ㅅ",
  "ㅇ",
  "ㅈ",
  "ㅊ",
  "ㅋ",
  "ㅌ",
  "ㅍ",
  "ㅎ",
  "A–Z",
  "#",
] as const;

type DirectoryInitialFilter = (typeof DIRECTORY_INITIAL_FILTERS)[number];

const BARISTA_SPECIALTY_ICON_SRC: Record<BaristaSpecialty, string> = {
  에스프레소: "/images/map-filters/espresso.webp",
  라떼아트: "/images/map-filters/latte-art.webp",
  브루잉: "/images/map-filters/brewing.webp",
  로스팅: "/images/map-filters/roasting.webp",
  "코칭/심사": "/images/map-filters/coaching-judge.webp",
};

function toNearbyProfile(
  profile: MapProfilesResponse["profiles"][number],
): NearbyProfile | null {
  if (!Number.isFinite(profile.lat) || !Number.isFinite(profile.lng))
    return null;

  const skills = normalizeDefaultBaristaSpecialties(profile.skills);

  return {
    ...profile,
    skills,
  };
}

function toDirectoryProfile(
  profile: DirectoryProfilesResponse["profiles"][number],
  nearbyProfile?: NearbyProfile,
): DirectoryProfile {
  return {
    ...profile,
    id: profile.profileId,
    workplaces:
      profile.workplaces.length > 0
        ? profile.workplaces
        : [profile.workplace].filter(Boolean),
    addresses: profile.addresses,
    bio: profile.bio,
    skills: normalizeDefaultBaristaSpecialties(profile.skills),
    ...(nearbyProfile
      ? { lat: nearbyProfile.lat, lng: nearbyProfile.lng }
      : {}),
  };
}

function readCachedUserLocation(): UserLocation | null {
  if (typeof window === "undefined") return null;

  try {
    const rawLocation = window.localStorage.getItem(
      LAST_USER_LOCATION_STORAGE_KEY,
    );
    if (!rawLocation) return null;

    const location = JSON.parse(rawLocation) as Partial<UserLocation> & {
      savedAt?: number;
    };
    if (
      typeof location.lat !== "number" ||
      typeof location.lng !== "number" ||
      typeof location.savedAt !== "number" ||
      !Number.isFinite(location.lat) ||
      !Number.isFinite(location.lng) ||
      Date.now() - location.savedAt > LAST_USER_LOCATION_MAX_AGE_MS
    )
      return null;

    return { lat: location.lat, lng: location.lng };
  } catch {
    return null;
  }
}

function cacheUserLocation(location: UserLocation) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      LAST_USER_LOCATION_STORAGE_KEY,
      JSON.stringify({ ...location, savedAt: Date.now() }),
    );
  } catch {
    // Ignore storage failures; location UX should still work for this session.
  }
}

function readDirectoryShuffleState(storageKey: string): unknown {
  if (typeof window === "undefined") return null;

  try {
    const value = window.localStorage.getItem(storageKey);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function saveDirectoryShuffleState(
  storageKey: string,
  state: BaristaDirectoryShuffleState,
) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    // Ignore storage failures; the current sheet order remains usable.
  }
}

function uniqueDirectoryProfiles<TProfile extends { profileId: string }>(
  profiles: TProfile[],
) {
  const profileIds = new Set<string>();

  return profiles.filter((profile) => {
    if (profileIds.has(profile.profileId)) return false;
    profileIds.add(profile.profileId);
    return true;
  });
}

function directoryShuffleStorageKey(
  userId: string,
  selectedFilters: BaristaSpecialty[],
) {
  const filterScope = [...selectedFilters].sort().join(",") || "all";
  return `${DIRECTORY_SHUFFLE_STORAGE_PREFIX}${userId}:${filterScope}`;
}

export function MapApp() {
  const searchParams = useSearchParams();
  const baristaId = searchParams.get("barista");
  const memberSnapshot = useMemberStore((state) => state.snapshot);
  const memberStatus = useMemberStore((state) => state.status);
  const loadMemberSnapshot = useMemberStore((state) => state.load);
  const mapRef = useRef<NaverMapInstance | null>(null);
  const nearbyRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const lastNearbyRefreshAtRef = useRef(0);
  const pendingLocationCenterRef = useRef<UserLocation | null>(null);
  const userLocationRef = useRef<UserLocation | null>(null);
  const activeLocationRequestRef = useRef(0);
  const activeLocationRequestSourceRef =
    useRef<LocationRequestSource>("browser");
  const initialLocationRequestStartedRef = useRef(false);
  const baristaFocusedRef = useRef(false);
  const movedMapSearchKeyRef = useRef<string | null>(null);
  const showLocationFailureModalRef = useRef(false);
  const locationToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [selectedFilters, setSelectedFilters] = useState<BaristaSpecialty[]>(
    [],
  );
  const [selectedPassportTags, setSelectedPassportTags] = useState<
    PassportMapTag[]
  >([]);
  const [nearbyProfiles, setNearbyProfiles] = useState<NearbyProfile[]>([]);
  const [mapStores, setMapStores] = useState<MapStore[]>([]);
  const [viewerPassport, setViewerPassport] = useState<CoffeePassport | null>(
    null,
  );
  const [selectedProfile, setSelectedProfile] = useState<NearbyProfile | null>(
    null,
  );
  const [selectedStoreGroup, setSelectedStoreGroup] = useState<{
    store: MapStore;
    profiles: NearbyProfile[];
  } | null>(null);
  const [savingFavoriteId, setSavingFavoriteId] = useState<string | null>(null);
  const [savingStoreFavoriteId, setSavingStoreFavoriteId] = useState<
    string | null
  >(null);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>("idle");
  const [locationPermissionContext, setLocationPermissionContext] =
    useState<LocationPermissionContext>({ source: "browser" });
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locationButtonLoading, setLocationButtonLoading] = useState(false);
  const [locationToast, setLocationToast] = useState<string | null>(null);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [directoryQuery, setDirectoryQuery] = useState("");
  const [directoryApiProfiles, setDirectoryApiProfiles] = useState<
    DirectoryProfilesResponse["profiles"]
  >([]);
  const [directoryRandomProfiles, setDirectoryRandomProfiles] = useState<
    DirectoryProfile[]
  >([]);
  const directoryRandomConsumedRef = useRef(0);
  const directoryRandomRosterSignatureRef = useRef("");
  const [mapSearchQuery, setMapSearchQuery] = useState("");
  const [mapReadyVersion, setMapReadyVersion] = useState(0);
  const [profilesLoaded, setProfilesLoaded] = useState(false);
  const [mapZoom, setMapZoom] = useState(12);
  const [profileGroup, setProfileGroup] = useState<NearbyProfile[] | null>(
    null,
  );
  const [appliedBaristaId, setAppliedBaristaId] = useState<string | null>(null);
  const [dismissedMapSearchKey, setDismissedMapSearchKey] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (baristaId) baristaFocusedRef.current = true;
  }, [baristaId]);

  useEffect(() => {
    userLocationRef.current = userLocation;
  }, [userLocation]);

  useEffect(() => {
    const timeoutId = window.setTimeout(
      () => setUserLocation(readCachedUserLocation()),
      0,
    );

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    void loadMemberSnapshot();
  }, [loadMemberSnapshot]);

  useEffect(() => {
    let mounted = true;

    const loadProfiles = async () => {
      try {
        const response = await fetch("/api/map/profiles", {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache" },
        });
        if (!response.ok) return;

        const data = (await response.json()) as MapProfilesResponse;
        if (!mounted) return;

        setNearbyProfiles(
          data.profiles
            .map(toNearbyProfile)
            .filter((profile): profile is NearbyProfile => Boolean(profile)),
        );
        setMapStores(data.stores ?? []);
        setViewerPassport(data.viewerPassport ?? null);
      } catch {
        if (mounted) {
          setNearbyProfiles([]);
          setMapStores([]);
          setViewerPassport(null);
        }
      } finally {
        if (mounted) setProfilesLoaded(true);
      }
    };

    const loadDirectoryProfiles = async () => {
      try {
        const response = await fetch("/api/member/directory", {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache" },
        });
        if (!response.ok) return;

        const data = (await response.json()) as DirectoryProfilesResponse;
        if (mounted) setDirectoryApiProfiles(data.profiles);
      } catch {
        if (mounted) setDirectoryApiProfiles([]);
      }
    };

    void loadProfiles();
    void loadDirectoryProfiles();

    const stopListening = listenForBlockedUser((userId) => {
      setNearbyProfiles((profiles) =>
        profiles.filter((profile) => profile.profileId !== userId),
      );
      setSelectedProfile((profile) =>
        profile?.profileId === userId ? null : profile,
      );
      setDirectoryApiProfiles((profiles) =>
        profiles.filter((profile) => profile.profileId !== userId),
      );
      useMemberStore.getState().removeBlockedUser(userId);
      void useMemberStore.getState().load({ force: true });
      void loadProfiles();
      void loadDirectoryProfiles();
    });

    const refreshProfiles = () => {
      if (document.visibilityState === "visible") {
        void loadProfiles();
        void loadDirectoryProfiles();
      }
    };

    window.addEventListener("focus", refreshProfiles);
    document.addEventListener("visibilitychange", refreshProfiles);

    return () => {
      mounted = false;
      window.removeEventListener("focus", refreshProfiles);
      document.removeEventListener("visibilitychange", refreshProfiles);
      stopListening();
    };
  }, []);

  useEffect(() => {
    if (profilesLoaded && (memberSnapshot || memberStatus === "error")) {
      stopGlobalLoading();
    }
  }, [memberSnapshot, memberStatus, profilesLoaded]);

  const scheduleNearbyRefresh = useCallback(() => {
    if (nearbyRefreshTimerRef.current)
      clearTimeout(nearbyRefreshTimerRef.current);

    nearbyRefreshTimerRef.current = setTimeout(() => {
      lastNearbyRefreshAtRef.current = Date.now();
    }, 350);
  }, []);

  const moveMapToLocation = useCallback(
    (location: UserLocation, zoom: number | null = 14) => {
      if (!mapRef.current?.setCenter || !window.naver?.maps) {
        pendingLocationCenterRef.current = location;
        return;
      }

      mapRef.current.setCenter(
        new window.naver.maps.LatLng(location.lat, location.lng),
      );
      if (zoom !== null) mapRef.current.setZoom?.(zoom);
      pendingLocationCenterRef.current = null;
    },
    [],
  );

  const showLocationToast = useCallback((message: string) => {
    if (locationToastTimerRef.current)
      clearTimeout(locationToastTimerRef.current);

    setLocationToast(message);
    locationToastTimerRef.current = setTimeout(() => {
      setLocationToast(null);
      locationToastTimerRef.current = null;
    }, 2400);
  }, []);

  const requestCurrentLocation = useCallback(
    (
      intent: MapLocationRequestIntent,
      options: LocationRequestOptions = {},
    ) => {
      const { showFailureModal = true } = options;
      if (intent === "recenter") baristaFocusedRef.current = false;
      const requestId = activeLocationRequestRef.current + 1;
      const shouldShowButtonLoading = intent === "recenter" && showFailureModal;
      activeLocationRequestRef.current = requestId;
      showLocationFailureModalRef.current = showFailureModal;
      setLocationStatus("requesting");
      if (shouldShowButtonLoading) setLocationButtonLoading(true);

      const applyLocation = (
        nextLocation: UserLocation,
        accuracy: number | null,
      ) => {
        const shouldCenterMap = shouldCenterMapForLocationRequest({
          intent,
          hasKnownUserLocation: userLocationRef.current !== null,
          baristaFocused: baristaFocusedRef.current,
        });
        if (shouldShowButtonLoading) setLocationButtonLoading(false);
        userLocationRef.current = nextLocation;
        setUserLocation(nextLocation);
        cacheUserLocation(nextLocation);
        void updateLastLocation(nextLocation.lat, nextLocation.lng).catch(
          () => {},
        );

        if (
          accuracy !== null &&
          Number.isFinite(accuracy) &&
          accuracy > MAX_TRUSTED_LOCATION_ACCURACY_METERS
        ) {
          setLocationStatus("low-accuracy");
          setShowPermissionModal(false);
          if (showFailureModal) {
            showLocationToast(
              "현재 위치 정확도가 낮아요. 지도를 대략적인 위치로 이동했어요.",
            );
          }
          if (shouldCenterMap) moveMapToLocation(nextLocation);
          scheduleNearbyRefresh();
          return;
        }

        setLocationStatus("granted");
        setShowPermissionModal(false);

        if (shouldCenterMap) moveMapToLocation(nextLocation);

        scheduleNearbyRefresh();
      };

      if (isNativeBridgeAvailable()) {
        activeLocationRequestSourceRef.current = "native";
        setLocationPermissionContext({ source: "native" });
        nativeBridge
          .getCurrentLocation({ preferLastKnown: intent !== "recenter" })
          .then((location) => {
            if (activeLocationRequestRef.current !== requestId) return;

            if (!location.granted) {
              setLocationPermissionContext({
                source: "native",
                canAskAgain: location.canAskAgain,
              });
              setLocationStatus("denied");
              if (shouldShowButtonLoading) setLocationButtonLoading(false);
              if (showFailureModal) setShowPermissionModal(true);
              return;
            }

            applyLocation(
              {
                lat: location.lat,
                lng: location.lng,
              },
              location.accuracy,
            );

            if (
              process.env.NODE_ENV !== "production" ||
              location.source !== "current"
            ) {
              console.info("[location] Native location resolved.", {
                accuracy: location.accuracy,
                elapsedMs: location.elapsedMs,
                platform: location.platform,
                source: location.source,
              });
            }
          })
          .catch((error) => {
            if (activeLocationRequestRef.current !== requestId) return;

            console.warn("[location] Native location request failed.", {
              message: error instanceof Error ? error.message : String(error),
            });
            setLocationPermissionContext({ source: "native" });
            setLocationStatus("unavailable");
            if (shouldShowButtonLoading) setLocationButtonLoading(false);
            setShowPermissionModal(false);
            if (showFailureModal)
              showLocationToast(
                "현재 위치를 가져오지 못했어요. 잠시 후 다시 시도해 주세요.",
              );
          });
        return;
      }

      activeLocationRequestSourceRef.current = "browser";
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        setLocationPermissionContext({ source: "browser" });
        setLocationStatus("unsupported");
        if (shouldShowButtonLoading) setLocationButtonLoading(false);
        setShowPermissionModal(false);
        if (showFailureModal)
          showLocationToast("이 기기에서는 위치 기능을 사용할 수 없어요.");
        return;
      }

      setLocationPermissionContext({ source: "browser" });
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (activeLocationRequestRef.current !== requestId) return;

          const nextLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };

          applyLocation(nextLocation, position.coords.accuracy);
        },
        (error) => {
          if (activeLocationRequestRef.current !== requestId) return;

          if (shouldShowButtonLoading) setLocationButtonLoading(false);

          if (error.code === error.PERMISSION_DENIED) {
            setLocationStatus("denied");
            if (showFailureModal) setShowPermissionModal(true);
            return;
          }

          setLocationStatus("unavailable");
          setShowPermissionModal(false);
          if (showFailureModal)
            showLocationToast(
              "현재 위치를 가져오지 못했어요. 잠시 후 다시 시도해 주세요.",
            );
        },
        {
          enableHighAccuracy: true,
          maximumAge: 60_000,
          timeout: 6_000,
        },
      );
    },
    [moveMapToLocation, scheduleNearbyRefresh, showLocationToast],
  );

  useEffect(() => {
    if (initialLocationRequestStartedRef.current) return;

    initialLocationRequestStartedRef.current = true;
    requestCurrentLocation("startup", {
      showFailureModal: false,
    });
  }, [requestCurrentLocation]);

  const openNativeAppSettings = useCallback(() => {
    if (!isNativeBridgeAvailable()) return;

    void nativeBridge.openAppSettings();
  }, []);

  useEffect(() => {
    if (locationStatus !== "requesting") return;

    const timeoutMs =
      activeLocationRequestSourceRef.current === "native"
        ? NATIVE_LOCATION_STUCK_TIMEOUT_MS
        : BROWSER_LOCATION_STUCK_TIMEOUT_MS;
    const stuckRequestTimer = setTimeout(() => {
      setLocationStatus((currentStatus) => {
        if (currentStatus !== "requesting") return currentStatus;

        activeLocationRequestRef.current += 1;
        setLocationButtonLoading(false);
        setShowPermissionModal(false);
        console.warn("[location] Location request timed out.", {
          source: activeLocationRequestSourceRef.current,
          timeoutMs,
        });
        if (showLocationFailureModalRef.current) {
          showLocationToast(
            "현재 위치 확인이 지연되고 있어요. 잠시 후 다시 시도해 주세요.",
          );
        }
        return "unavailable";
      });
    }, timeoutMs);

    return () => clearTimeout(stuckRequestTimer);
  }, [locationStatus, showLocationToast]);

  useEffect(() => {
    return () => {
      if (nearbyRefreshTimerRef.current)
        clearTimeout(nearbyRefreshTimerRef.current);
      if (locationToastTimerRef.current)
        clearTimeout(locationToastTimerRef.current);
    };
  }, []);

  const filteredProfiles = useMemo(() => {
    const viewerRole = memberSnapshot?.profile.role;

    return nearbyProfiles
      .filter((profile) => {
        const matchesFilter =
          selectedFilters.length === 0 ||
          selectedFilters.some((filter) => profile.skills.includes(filter));
        const matchesSearch = matchesMapSearch(profile, mapSearchQuery);

        return matchesFilter && matchesSearch;
      })
      .map((profile) => ({
        ...profile,
        canMessage: canShowMapMessageAction({
          serverAllowed: profile.canMessage,
          viewerRole,
          isOwnProfile: profile.isOwnProfile,
        }),
      }));
  }, [
    mapSearchQuery,
    memberSnapshot?.profile.role,
    nearbyProfiles,
    selectedFilters,
  ]);

  const searchedMapProfile = useMemo(
    () => findUniqueSearchedMapProfile(filteredProfiles, mapSearchQuery),
    [filteredProfiles, mapSearchQuery],
  );
  const mapSearchKey = searchedMapProfile
    ? `${mapSearchQuery.trim().toLowerCase()}|${searchedMapProfile.profileId}`
    : null;
  const openedSearchProfile =
    searchedMapProfile && dismissedMapSearchKey !== mapSearchKey
      ? searchedMapProfile
      : null;
  const profileForSheet = openedSearchProfile ?? selectedProfile;
  const activeProfile = useMemo(
    () => resolveOpenedMapProfile(profileForSheet, filteredProfiles),
    [filteredProfiles, profileForSheet],
  );
  const markerProfiles = useMemo(
    () => profilesForMapMarkers(filteredProfiles, profileForSheet),
    [filteredProfiles, profileForSheet],
  );

  const directoryProfiles = useMemo(
    () =>
      uniqueDirectoryProfiles(
        directoryApiProfiles
          .map((profile) =>
            toDirectoryProfile(
              profile,
              nearbyProfiles.find(
                (nearbyProfile) =>
                  nearbyProfile.profileId === profile.profileId,
              ),
            ),
          )
          .filter(
            (profile) =>
              selectedFilters.length === 0 ||
              selectedFilters.some((filter) => profile.skills.includes(filter)),
          ),
      ),
    [directoryApiProfiles, nearbyProfiles, selectedFilters],
  );
  const directorySortedProfiles = useMemo(
    () =>
      buildBaristaDirectorySections(directoryProfiles, directoryQuery).flatMap(
        (section) => section.profiles,
      ),
    [directoryProfiles, directoryQuery],
  );
  const directorySearchMatches = useMemo(
    () =>
      uniqueDirectoryProfiles(
        buildBaristaDirectorySections(
          directoryProfiles,
          mapSearchQuery,
        ).flatMap((section) => section.profiles),
      ),
    [directoryProfiles, mapSearchQuery],
  );
  const directoryVisibleProfileCount = directorySearchMatches.length;
  const directoryStorageKey = useMemo(
    () =>
      memberSnapshot?.profile.id
        ? directoryShuffleStorageKey(memberSnapshot.profile.id, selectedFilters)
        : null,
    [memberSnapshot, selectedFilters],
  );

  useEffect(() => {
    if (!directoryOpen) return;

    const profileIds = directoryProfiles.map((profile) => profile.profileId);
    const rosterSignature = `${directoryStorageKey ?? ""}|${profileIds.join("|")}`;
    if (directoryRandomRosterSignatureRef.current === rosterSignature) return;

    const shuffleState = reconcileBaristaDirectoryShuffleState(
      profileIds,
      directoryStorageKey
        ? readDirectoryShuffleState(directoryStorageKey)
        : null,
    );
    const profilesById = new Map(
      directoryProfiles.map((profile) => [profile.profileId, profile]),
    );
    const exposedProfiles = directoryRandomProfiles
      .slice(0, directoryRandomConsumedRef.current)
      .filter((profile) => profilesById.has(profile.profileId));
    const exposedProfileIds = new Set(
      exposedProfiles.map((profile) => profile.profileId),
    );
    const remainingProfileIds = shuffleState.remaining.filter(
      (profileId) => !exposedProfileIds.has(profileId),
    );

    directoryRandomConsumedRef.current = exposedProfiles.length;
    directoryRandomRosterSignatureRef.current = rosterSignature;
    setDirectoryRandomProfiles(
      uniqueDirectoryProfiles([
        ...exposedProfiles,
        ...orderBaristaDirectoryProfiles(
          directoryProfiles,
          remainingProfileIds,
        ),
      ]),
    );
    if (directoryStorageKey)
      saveDirectoryShuffleState(directoryStorageKey, {
        ...shuffleState,
        remaining: remainingProfileIds,
      });
  }, [
    directoryOpen,
    directoryProfiles,
    directoryRandomProfiles,
    directoryStorageKey,
  ]);

  useEffect(() => {
    scheduleNearbyRefresh();
  }, [mapSearchQuery, scheduleNearbyRefresh, selectedFilters]);

  const handleToggleFilter = useCallback((filter: BaristaSpecialty) => {
    setSelectedFilters((current) =>
      current.includes(filter)
        ? current.filter((item) => item !== filter)
        : [...current, filter],
    );
  }, []);

  const handleTogglePassportTag = useCallback((tag: PassportMapTag) => {
    setSelectedPassportTags((current) =>
      current.includes(tag)
        ? current.filter((item) => item !== tag)
        : [...current, tag],
    );
  }, []);

  const handleBlankMapClick = useCallback(() => {
    if (mapSearchKey) setDismissedMapSearchKey(mapSearchKey);
    setSelectedProfile(null);
    setProfileGroup(null);
    setSelectedStoreGroup(null);
  }, [mapSearchKey]);

  const handleMapReady = useCallback(
    (map: NaverMapInstance) => {
      mapRef.current = map;
      setMapReadyVersion((version) => version + 1);
      setMapZoom(map.getZoom?.() ?? 12);

      const locationToCenter =
        pendingLocationCenterRef.current ??
        (baristaFocusedRef.current ? null : userLocationRef.current);
      if (locationToCenter) moveMapToLocation(locationToCenter);
    },
    [moveMapToLocation],
  );

  const handleMapIntent = useCallback(() => {
    scheduleNearbyRefresh();
    setMapZoom(mapRef.current?.getZoom?.() ?? 12);
  }, [scheduleNearbyRefresh]);

  const handleDirectoryProfileSelect = useCallback(
    (profile: DirectoryProfile) => {
      setProfileGroup(null);
      setSelectedStoreGroup(null);
      setDirectoryOpen(false);
      setDirectoryQuery("");
      setDirectoryRandomProfiles([]);
      directoryRandomConsumedRef.current = 0;
      directoryRandomRosterSignatureRef.current = "";

      const nearbyProfile = findSearchedMapBaristaLocation(
        nearbyProfiles,
        profile.profileId,
        directoryQuery,
      );
      if (!nearbyProfile) {
        window.location.assign(getDirectoryProfileHref(profile.profileId));
        return;
      }

      baristaFocusedRef.current = true;
      if (mapSearchKey) setDismissedMapSearchKey(mapSearchKey);
      setSelectedProfile(nearbyProfile);
      moveMapToLocation({ lat: nearbyProfile.lat, lng: nearbyProfile.lng });
    },
    [directoryQuery, mapSearchKey, moveMapToLocation, nearbyProfiles],
  );

  useEffect(() => {
    if (!profilesLoaded || !baristaId || appliedBaristaId === baristaId) return;

    const nearbyProfile = findOpenedMapBarista(nearbyProfiles, baristaId);
    if (!nearbyProfile) {
      window.location.assign(getDirectoryProfileHref(baristaId));
      return;
    }

    baristaFocusedRef.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- open the searched barista once after profiles load
    setAppliedBaristaId(baristaId);
    setSelectedProfile(nearbyProfile);
    moveMapToLocation({ lat: nearbyProfile.lat, lng: nearbyProfile.lng });
  }, [
    appliedBaristaId,
    baristaId,
    moveMapToLocation,
    nearbyProfiles,
    profilesLoaded,
  ]);

  useEffect(() => {
    if (!openedSearchProfile || !mapSearchKey) return;
    if (movedMapSearchKeyRef.current === mapSearchKey) return;

    movedMapSearchKeyRef.current = mapSearchKey;
    baristaFocusedRef.current = true;
    moveMapToLocation({
      lat: openedSearchProfile.lat,
      lng: openedSearchProfile.lng,
    });
  }, [mapSearchKey, moveMapToLocation, openedSearchProfile]);

  const handleDirectoryOpen = () => {
    if (!directoryStorageKey) {
      void loadMemberSnapshot({ force: true });
      return;
    }

    const profileIds = directoryProfiles.map((profile) => profile.profileId);
    let shuffleState = reconcileBaristaDirectoryShuffleState(
      profileIds,
      readDirectoryShuffleState(directoryStorageKey),
    );

    if (shuffleState.remaining.length === 0) {
      shuffleState = createBaristaDirectoryShuffleState(profileIds);
    }
    saveDirectoryShuffleState(directoryStorageKey, shuffleState);

    setDirectoryRandomProfiles(
      orderBaristaDirectoryProfiles(directoryProfiles, shuffleState.remaining),
    );
    directoryRandomConsumedRef.current = 0;
    directoryRandomRosterSignatureRef.current = `${directoryStorageKey}|${profileIds.join("|")}`;
    setDirectoryOpen(true);
    setProfileGroup(null);
    setSelectedStoreGroup(null);
    setDirectoryQuery(mapSearchQuery);
  };

  const handleDirectoryRandomReveal = (visibleCount: number) => {
    const consumedCount = Math.max(
      directoryRandomConsumedRef.current,
      visibleCount,
    );
    if (consumedCount === directoryRandomConsumedRef.current) return;

    directoryRandomConsumedRef.current = consumedCount;
    if (!directoryStorageKey) return;

    saveDirectoryShuffleState(directoryStorageKey, {
      roster: directoryProfiles.map((profile) => profile.profileId),
      remaining: directoryRandomProfiles
        .slice(consumedCount)
        .map((profile) => profile.profileId),
    });
  };

  const handleDirectoryClose = () => {
    setDirectoryOpen(false);
    setDirectoryQuery("");
    setDirectoryRandomProfiles([]);
    directoryRandomConsumedRef.current = 0;
    directoryRandomRosterSignatureRef.current = "";
  };

  const updateProfileFavorite = useCallback(
    (profileId: string, favorited: boolean, favoriteCount?: number) => {
      const applyFavorite = (profile: NearbyProfile) =>
        profile.profileId === profileId
          ? {
              ...profile,
              favorited,
              favoriteCount: favoriteCount ?? profile.favoriteCount,
            }
          : profile;

      setNearbyProfiles((current) =>
        current.map((profile) => applyFavorite(profile)),
      );
      setSelectedProfile((current) =>
        current ? applyFavorite(current) : current,
      );
    },
    [],
  );

  const handleFavoriteToggle = useCallback(
    async (profile: NearbyProfile) => {
      if (savingFavoriteId || profile.isOwnProfile) return;

      const nextFavorited = !profile.favorited;
      const nextFavoriteCount = Math.max(
        0,
        profile.favoriteCount + (nextFavorited ? 1 : -1),
      );
      updateProfileFavorite(
        profile.profileId,
        nextFavorited,
        nextFavoriteCount,
      );
      setSavingFavoriteId(profile.profileId);

      try {
        const response = await fetch(
          `/api/map/favorites/${encodeURIComponent(profile.profileId)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ favorited: nextFavorited }),
          },
        );

        if (response.status === 401) {
          window.location.assign("/login");
          return;
        }

        if (!response.ok) throw new Error("즐겨찾기를 저장하지 못했습니다.");

        const result = (await response.json()) as {
          favorited: boolean;
          favoriteCount?: number;
        };
        updateProfileFavorite(
          profile.profileId,
          result.favorited,
          result.favoriteCount,
        );
        void useMemberStore.getState().load({ force: true });
      } catch {
        updateProfileFavorite(
          profile.profileId,
          profile.favorited,
          profile.favoriteCount,
        );
        window.alert("즐겨찾기를 저장하지 못했습니다.");
      } finally {
        setSavingFavoriteId(null);
      }
    },
    [savingFavoriteId, updateProfileFavorite],
  );

  const markerGroups = useMemo(() => {
    const groups = buildMapMarkerGroups(markerProfiles, mapZoom);
    if (selectedPassportTags.length === 0) return groups;
    return groups.filter((group) => {
      const firstProfile = group.profiles[0];
      if (!firstProfile) return false;
      const store = matchShowroomToPlace(
        mapStores,
        group.profiles,
        firstProfile.workplace,
        group.lat,
        group.lng,
      );
      if (!store) return false;
      return storeMatchesTagFilters(
        store.tasteProfile,
        selectedPassportTags,
        Boolean(store.hasActiveBeans),
      );
    });
  }, [mapStores, mapZoom, markerProfiles, selectedPassportTags]);
  const showLocationCheckingNotice =
    locationStatus === "requesting" && !locationButtonLoading;
  const showEmptyState = shouldShowMapEmptyState({
    profilesLoaded,
    filteredProfileCount:
      selectedPassportTags.length > 0
        ? markerGroups.length
        : markerProfiles.length,
  });

  const handleStoreFavoriteToggle = useCallback(
    async (store: MapStore) => {
      if (savingStoreFavoriteId) return;
      const nextFavorited = !store.favorited;
      setSavingStoreFavoriteId(store.id);
      try {
        await toggleStoreFavorite(store.id, nextFavorited);
        setMapStores((current) =>
          current.map((item) =>
            item.id === store.id ? { ...item, favorited: nextFavorited } : item,
          ),
        );
        setSelectedStoreGroup((current) =>
          current && current.store.id === store.id
            ? {
                ...current,
                store: { ...current.store, favorited: nextFavorited },
              }
            : current,
        );
      } catch {
        window.alert("매장 찜 상태를 저장하지 못했습니다.");
      } finally {
        setSavingStoreFavoriteId(null);
      }
    },
    [savingStoreFavoriteId],
  );

  const handleMarkerGroupClick = useCallback(
    (group: MapMarkerGroup<NearbyProfile>) => {
      const [firstProfile] = group.profiles;
      if (!firstProfile) return;

      const matchedStore = matchShowroomToPlace(
        mapStores,
        group.profiles,
        firstProfile.workplace,
        group.lat,
        group.lng,
      );
      if (matchedStore) {
        if (mapSearchKey) setDismissedMapSearchKey(mapSearchKey);
        setSelectedProfile(null);
        setProfileGroup(null);
        setSelectedStoreGroup({
          store: matchedStore,
          profiles: group.profiles,
        });
        return;
      }

      setSelectedStoreGroup(null);

      if (group.profiles.length === 1) {
        if (mapSearchKey) setDismissedMapSearchKey(mapSearchKey);
        setSelectedProfile(firstProfile);
        setProfileGroup(null);
        return;
      }

      if (group.clustered && mapRef.current?.setZoom) {
        const nextZoom = Math.max(mapZoom + 2, MAP_CLUSTER_ZOOM_THRESHOLD);
        mapRef.current.setZoom(nextZoom);
        setMapZoom(nextZoom);
        return;
      }

      setSelectedProfile(null);
      setProfileGroup(group.profiles);
    },
    [mapSearchKey, mapStores, mapZoom],
  );

  useEffect(() => {
    if (!mapReadyVersion || !mapRef.current || !window.naver?.maps) return;

    const maps = window.naver.maps;
    const listeners: unknown[] = [];
    const markers = markerGroups.map((group) => {
      const profile = group.profiles[0];
      const representativeProfile = selectMapMarkerRepresentative(
        group.profiles,
      );
      if (!profile || !representativeProfile) return null;
      const matchedStore = matchShowroomToPlace(
        mapStores,
        group.profiles,
        profile.workplace,
        group.lat,
        group.lng,
      );
      const hasNotice = Boolean(matchedStore?.statusNotice);
      const hasTimesale = (matchedStore?.activeTimesaleCoupons.length ?? 0) > 0;
      const stamped = (matchedStore?.stampCount ?? 0) > 0;
      const canRedeem = Boolean(matchedStore?.canRedeem);
      const groupSelected = selectedStoreGroup
        ? matchedStore?.id === selectedStoreGroup.store.id
        : profileGroup
          ? profileGroup.some((selected) => selected.id === profile.id)
          : group.profiles.length === 1 && activeProfile?.id === profile.id;
      const marker = new maps.Marker({
        position: new maps.LatLng(group.lat, group.lng),
        map: mapRef.current,
        icon: {
          content:
            group.profiles.length > 1
              ? profileClusterMarkerContent(
                  representativeProfile,
                  group.profiles.length,
                  groupSelected,
                  { hasNotice, hasTimesale, stamped, canRedeem },
                )
              : profileMarkerContent(
                  { ...profile, hasNotice, hasTimesale, stamped, canRedeem },
                  groupSelected,
                ),
          size:
            group.profiles.length > 1
              ? new maps.Size(52, 44)
              : new maps.Size(44, 44),
          anchor:
            group.profiles.length > 1
              ? new maps.Point(22, 39)
              : new maps.Point(22, 37),
        },
      });
      const listener = maps.Event.addListener?.(marker, "click", () => {
        handleMarkerGroupClick(group);
      });
      if (listener) listeners.push(listener);
      return marker;
    });

    return () => {
      markers.forEach((marker) => marker?.setMap(null));
      if (maps.Event.removeListener) {
        listeners.forEach((listener) => maps.Event.removeListener?.(listener));
      }
    };
  }, [
    activeProfile?.id,
    handleMarkerGroupClick,
    mapReadyVersion,
    mapStores,
    markerGroups,
    profileGroup,
    selectedStoreGroup,
  ]);

  return (
    <div className="mx-auto h-[100dvh] max-w-[var(--app-shell-max-width)] overflow-hidden bg-[var(--surface)]">
      <MapHeader />
      <main className="relative h-full pt-[calc(4rem+env(safe-area-inset-top))]">
        <div
          className={
            directoryOpen ? "invisible pointer-events-none" : undefined
          }
        >
          <NaverMapLayer
            locationStatus={locationStatus}
            logoVisible={!directoryOpen}
            onBlankMapClick={handleBlankMapClick}
            onMapReady={handleMapReady}
            onMapIntent={handleMapIntent}
            userLocation={userLocation}
          />
        </div>

        <MapFilters
          filteredCount={directoryVisibleProfileCount}
          searchQuery={mapSearchQuery}
          selectedFilters={selectedFilters}
          selectedPassportTags={selectedPassportTags}
          onDirectoryOpen={handleDirectoryOpen}
          onSearchQueryChange={setMapSearchQuery}
          onToggle={handleToggleFilter}
          onTogglePassportTag={handleTogglePassportTag}
        />

        {!profilesLoaded ? <MapProfilesLoadingState /> : null}

        {showEmptyState ? (
          <MapEmptyState
            hasFilters={
              selectedFilters.length > 0 || selectedPassportTags.length > 0
            }
            onReset={() => {
              setSelectedFilters([]);
              setSelectedPassportTags([]);
            }}
          />
        ) : null}

        <MapLocationButton
          activeProfile={activeProfile !== null || selectedStoreGroup !== null}
          loading={locationButtonLoading}
          onClick={() => requestCurrentLocation("recenter")}
        />

        {activeProfile ? (
          <MapProfileDetailSheet
            favorite={activeProfile.favorited}
            profile={activeProfile}
            savingFavorite={savingFavoriteId === activeProfile.profileId}
            onFavoriteToggle={() => void handleFavoriteToggle(activeProfile)}
          />
        ) : null}

        {selectedStoreGroup ? (
          <MapStoreSheet
            store={{
              id: selectedStoreGroup.store.id,
              storeName: selectedStoreGroup.store.storeName,
              address:
                selectedStoreGroup.store.location?.address ??
                selectedStoreGroup.profiles[0]?.address,
              statusNotice: selectedStoreGroup.store.statusNotice,
              tasteProfile: selectedStoreGroup.store.tasteProfile,
              favorited: selectedStoreGroup.store.favorited,
              stampCount: selectedStoreGroup.store.stampCount,
              canRedeem: selectedStoreGroup.store.canRedeem,
              hasActiveBeans: selectedStoreGroup.store.hasActiveBeans,
              businessVerified: selectedStoreGroup.store.businessVerified,
              activeTimesaleCoupons:
                selectedStoreGroup.store.activeTimesaleCoupons,
            }}
            profiles={selectedStoreGroup.profiles}
            viewerPassport={viewerPassport}
            savingFavorite={
              savingStoreFavoriteId === selectedStoreGroup.store.id
            }
            onClose={() => setSelectedStoreGroup(null)}
            onFavoriteToggle={() =>
              void handleStoreFavoriteToggle(selectedStoreGroup.store)
            }
            onProfileSelect={(profile) => {
              if (mapSearchKey) setDismissedMapSearchKey(mapSearchKey);
              setSelectedProfile(profile);
              setSelectedStoreGroup(null);
            }}
          />
        ) : null}

        {profileGroup ? (
          <MapProfileGroupSheet
            profiles={profileGroup}
            onClose={() => setProfileGroup(null)}
            onProfileSelect={(profile) => {
              if (mapSearchKey) setDismissedMapSearchKey(mapSearchKey);
              setSelectedProfile(profile);
              setProfileGroup(null);
            }}
          />
        ) : null}

        {directoryOpen ? (
          <BaristaDirectorySheet
            query={directoryQuery}
            profiles={directorySortedProfiles}
            randomProfiles={directoryRandomProfiles}
            totalCount={directoryProfiles.length}
            onClose={handleDirectoryClose}
            onProfileSelect={handleDirectoryProfileSelect}
            onQueryChange={(query) => {
              setDirectoryQuery(query);
              setMapSearchQuery(query);
            }}
            onRandomReveal={handleDirectoryRandomReveal}
          />
        ) : null}

        {showPermissionModal ? (
          <PermissionModal
            context={locationPermissionContext}
            status={locationStatus}
            onClose={() => setShowPermissionModal(false)}
            onOpenSettings={openNativeAppSettings}
            onRetry={() => requestCurrentLocation("recenter")}
          />
        ) : null}

        {showLocationCheckingNotice ? (
          <MapLocationCheckingNotice activeProfile={activeProfile} />
        ) : null}

        {locationToast ? (
          <MapLocationToast
            message={locationToast}
            activeProfile={activeProfile}
          />
        ) : null}
      </main>
      <BottomNav active="map" />
    </div>
  );
}

function MapHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-40 mx-auto max-w-[var(--app-shell-max-width)] border-b border-[var(--border)] bg-[var(--surface)] pt-[env(safe-area-inset-top)]">
      <div className="grid h-16 grid-cols-[84px_1fr_84px] items-center px-2">
        <div aria-hidden className="h-11 w-[84px]" />
        <Link
          prefetch={false}
          href="/home"
          className="logo-wordmark text-center text-[25px] font-bold text-[var(--fg-strong)]"
        >
          BLENDING
        </Link>
        <HeaderIconActions searchHref="/home/search" loadUnreadNotifications />
      </div>
    </header>
  );
}

function MapLocationCheckingNotice({
  activeProfile,
}: {
  activeProfile: NearbyProfile | null;
}) {
  return (
    <div
      role="status"
      className={`pointer-events-none absolute left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-[var(--radius-pill)] border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-2 text-[13px] font-bold leading-[1.4] text-[var(--fg)] shadow-[var(--shadow-card)] ${
        activeProfile
          ? "bottom-[calc(var(--app-bottom-nav-height)+204px)]"
          : "bottom-[calc(var(--app-bottom-nav-height)+76px)]"
      }`}
    >
      <LoaderCircle
        size={16}
        strokeWidth={2.4}
        className="animate-spin text-[var(--accent)]"
      />
      현재 위치 확인 중
    </div>
  );
}

function MapLocationToast({
  activeProfile,
  message,
}: {
  activeProfile: NearbyProfile | null;
  message: string;
}) {
  return (
    <div
      role="status"
      className={`pointer-events-none absolute inset-x-5 z-40 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--fg)] px-4 py-3 text-center text-[13px] font-bold leading-[1.45] text-[var(--surface)] shadow-[var(--shadow-modal)] ${
        activeProfile
          ? "bottom-[calc(var(--app-bottom-nav-height)+204px)]"
          : "bottom-[calc(var(--app-bottom-nav-height)+76px)]"
      }`}
    >
      {message}
    </div>
  );
}

function MapFilters({
  filteredCount,
  searchQuery,
  selectedFilters,
  selectedPassportTags,
  onDirectoryOpen,
  onSearchQueryChange,
  onToggle,
  onTogglePassportTag,
}: {
  filteredCount: number;
  searchQuery: string;
  selectedFilters: BaristaSpecialty[];
  selectedPassportTags: PassportMapTag[];
  onDirectoryOpen: () => void;
  onSearchQueryChange: (query: string) => void;
  onToggle: (filter: BaristaSpecialty) => void;
  onTogglePassportTag: (tag: PassportMapTag) => void;
}) {
  return (
    <section className="absolute inset-x-0 top-[calc(76px+env(safe-area-inset-top))] z-30 px-5">
      <MapSearchBar
        filteredCount={filteredCount}
        searchQuery={searchQuery}
        onDirectoryOpen={onDirectoryOpen}
        onSearchFocus={() => {
          if (searchQuery.trim()) onDirectoryOpen();
        }}
        onSearchQueryChange={onSearchQueryChange}
      />

      <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {PASSPORT_MAP_TAGS.map((tag) => (
          <Chip
            key={tag.value}
            selected={selectedPassportTags.includes(tag.value)}
            onClick={() => onTogglePassportTag(tag.value)}
          >
            {tag.label}
          </Chip>
        ))}
        <span className="shrink-0 pl-1 text-[11px] font-medium text-[var(--fg-subtle)]">
          바리스타
        </span>
        {BARISTA_SPECIALTIES.map((specialty) => {
          const selected = selectedFilters.includes(specialty.value);
          return (
            <Chip
              key={specialty.value}
              selected={selected}
              onClick={() => onToggle(specialty.value)}
              leading={
                <span
                  aria-hidden
                  className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-pill)] bg-[var(--surface)]"
                >
                  <Image
                    src={BARISTA_SPECIALTY_ICON_SRC[specialty.value]}
                    alt=""
                    width={24}
                    height={24}
                    className="object-contain"
                  />
                </span>
              }
            >
              {specialty.label}
            </Chip>
          );
        })}
      </div>
    </section>
  );
}

function MapEmptyState({
  hasFilters,
  onReset,
}: {
  hasFilters: boolean;
  onReset: () => void;
}) {
  return (
    <section className="absolute inset-x-5 top-[calc(166px+env(safe-area-inset-top))] z-30 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 text-center shadow-[var(--shadow-card)]">
      <UserRound
        size={28}
        strokeWidth={1.8}
        className="mx-auto text-[var(--fg-subtle)]"
      />
      <h2 className="mt-2 text-[16px] font-bold leading-[1.4] text-[var(--fg-strong)]">
        조건에 맞는 카페·바리스타가 없습니다
      </h2>
      <p className="mt-2 text-[13px] leading-[1.6] text-[var(--fg-muted)]">
        다른 카페명, 바리스타명, 지역, 스킬로 다시 찾아보세요.
      </p>
      {hasFilters ? (
        <button
          type="button"
          onClick={onReset}
          className="mt-4 rounded-[var(--radius-lg)] border border-[var(--border-strong)] px-4 py-2 text-[13px] font-bold text-[var(--fg)] transition active:scale-[0.98]"
        >
          검색 조건 초기화
        </button>
      ) : null}
    </section>
  );
}

function MapProfilesLoadingState() {
  return (
    <section className="absolute inset-x-5 top-[calc(166px+env(safe-area-inset-top))] z-30 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 text-center shadow-[var(--shadow-card)]">
      <div className="mx-auto h-8 w-8 animate-spin rounded-[var(--radius-pill)] border-2 border-[var(--border-strong)] border-t-[var(--accent)]" />
      <h2 className="mt-3 text-[16px] font-bold leading-[1.4] text-[var(--fg-strong)]">
        주변 바리스타를 불러오는 중
      </h2>
      <p className="mt-2 text-[13px] leading-[1.6] text-[var(--fg-muted)]">
        조건에 맞는 프로필을 확인하고 있습니다.
      </p>
    </section>
  );
}

function NaverMapLayer({
  locationStatus,
  logoVisible,
  onBlankMapClick,
  onMapReady,
  onMapIntent,
  userLocation,
}: {
  locationStatus: LocationStatus;
  logoVisible: boolean;
  onBlankMapClick: () => void;
  onMapReady: (map: NaverMapInstance) => void;
  onMapIntent: () => void;
  userLocation: UserLocation | null;
}) {
  const mapElementRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<NaverMapInstance | null>(null);
  const userMarkerRef = useRef<NaverMarkerInstance | null>(null);
  const latestLocationRef = useRef<UserLocation | null>(null);
  const latestLogoVisibleRef = useRef(logoVisible);
  const [status, setStatus] = useState<"fallback" | "loading" | "ready">(() =>
    NAVER_MAP_KEY_ID ? "loading" : "fallback",
  );

  useEffect(() => {
    latestLocationRef.current = userLocation;
  }, [userLocation]);

  useEffect(() => {
    latestLogoVisibleRef.current = logoVisible;
  }, [logoVisible]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const maps = window.naver?.maps;
    if (!map?.setOptions || !maps) return;
    map.setOptions(naverLogoControlOptions(maps, logoVisible));
  }, [logoVisible]);

  useEffect(() => {
    if (!NAVER_MAP_KEY_ID) return;
    if (mapInstanceRef.current) return;

    let mounted = true;
    const listeners: unknown[] = [];

    loadNaverMaps(NAVER_MAP_KEY_ID)
      .then(() => {
        if (!mounted) return;
        if (!mapElementRef.current || !window.naver?.maps) {
          setStatus("fallback");
          return;
        }

        const maps = window.naver.maps;
        const initialLocation = latestLocationRef.current;
        const initialCenter = initialLocation
          ? new maps.LatLng(initialLocation.lat, initialLocation.lng)
          : new maps.LatLng(37.5665, 126.978);
        const map = new maps.Map(mapElementRef.current, {
          center: initialCenter,
          disableDoubleClickZoom: false,
          draggable: true,
          keyboardShortcuts: true,
          ...naverLogoControlOptions(maps, latestLogoVisibleRef.current),
          mapDataControl: false,
          pinchZoom: true,
          scaleControl: false,
          scrollWheel: true,
          zoom: 12,
          zoomControl: false,
        });

        mapInstanceRef.current = map;
        const clickListener = maps.Event.addListener?.(
          map,
          "click",
          onBlankMapClick,
        );
        const idleListener = maps.Event.addListener?.(map, "idle", onMapIntent);
        const zoomListener = maps.Event.addListener?.(
          map,
          "zoom_changed",
          onMapIntent,
        );

        if (clickListener) listeners.push(clickListener);
        if (idleListener) listeners.push(idleListener);
        if (zoomListener) listeners.push(zoomListener);

        maps.Event.once(map, "init", () => {
          if (mounted) setStatus("ready");
        });

        onMapReady(map);
        setStatus("ready");
      })
      .catch(() => {
        if (mounted) setStatus("fallback");
      });

    return () => {
      mounted = false;
      if (window.naver?.maps.Event.removeListener) {
        listeners.forEach((listener) =>
          window.naver?.maps.Event.removeListener?.(listener),
        );
      }
    };
  }, [onBlankMapClick, onMapIntent, onMapReady]);

  useEffect(() => {
    if (!mapInstanceRef.current || !window.naver?.maps) return;

    if (!userLocation) {
      userMarkerRef.current?.setMap(null);
      userMarkerRef.current = null;
      return;
    }

    const maps = window.naver.maps;
    const position = new maps.LatLng(userLocation.lat, userLocation.lng);

    if (userMarkerRef.current) {
      userMarkerRef.current.setPosition?.(position);
      return;
    }

    userMarkerRef.current = new maps.Marker({
      position,
      map: mapInstanceRef.current,
      icon: {
        content: userLocationMarkerContent(),
        size: new maps.Size(104, 104),
        anchor: new maps.Point(52, 52),
      },
      zIndex: 120,
    });

    return () => {
      userMarkerRef.current?.setMap(null);
      userMarkerRef.current = null;
    };
  }, [status, userLocation]);

  return (
    <div className="absolute inset-x-0 bottom-0 top-[calc(4rem+env(safe-area-inset-top))] overflow-hidden bg-[var(--surface-alt)]">
      {status !== "ready" ? (
        <MapLoadingFallback locationStatus={locationStatus} />
      ) : null}
      <div
        ref={mapElementRef}
        aria-hidden={status !== "ready"}
        className="h-full w-full"
        style={{ opacity: status === "ready" ? 1 : 0 }}
      />
    </div>
  );
}

function MapLoadingFallback({
  locationStatus,
}: {
  locationStatus: LocationStatus;
}) {
  const isDenied =
    locationStatus === "denied" ||
    locationStatus === "low-accuracy" ||
    locationStatus === "unsupported";

  if (isDenied) return <StaticMapFallback />;

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[var(--surface-alt)] px-8 text-center">
      <div>
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-[var(--radius-pill)] border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--accent)]">
          <LocateFixed size={24} strokeWidth={2.4} />
        </span>
        <p className="mt-4 text-[16px] font-bold text-[var(--fg-strong)]">
          내 위치 확인 중
        </p>
        <p className="mt-2 text-[13px] leading-[1.6] text-[var(--fg-muted)]">
          현재 위치를 기준으로 주변 바리스타를 불러오고 있습니다.
        </p>
      </div>
    </div>
  );
}

function BaristaDirectorySheet({
  query,
  profiles,
  randomProfiles,
  totalCount,
  onClose,
  onProfileSelect,
  onQueryChange,
  onRandomReveal,
}: {
  query: string;
  profiles: DirectoryProfile[];
  randomProfiles: DirectoryProfile[];
  totalCount: number;
  onClose: () => void;
  onProfileSelect: (profile: DirectoryProfile) => void;
  onQueryChange: (query: string) => void;
  onRandomReveal: (visibleCount: number) => void;
}) {
  const [randomWindowStart, setRandomWindowStart] = useState(0);
  const initialFilterScrollRef = useRef<HTMLDivElement>(null);
  const [initialFilterIndicator, setInitialFilterIndicator] = useState({
    offset: 0,
    thumbWidth: 0,
  });
  const [selectedInitial, setSelectedInitial] =
    useState<DirectoryInitialFilter>("전체");
  const showRandomProfiles = !query.trim() && selectedInitial === "전체";
  const filteredProfiles = useMemo(
    () =>
      showRandomProfiles
        ? randomProfiles
        : profiles.filter(
            (profile) =>
              selectedInitial === "전체" ||
              getBaristaDirectoryInitial(profile.name) === selectedInitial,
          ),
    [profiles, randomProfiles, selectedInitial, showRandomProfiles],
  );
  const visibleProfiles = rotateBaristaDirectoryProfiles(
    filteredProfiles,
    showRandomProfiles ? randomWindowStart : 0,
  );

  const updateInitialFilterIndicator = useCallback(() => {
    const element = initialFilterScrollRef.current;
    if (!element) return;

    setInitialFilterIndicator(
      getHorizontalScrollIndicatorGeometry(
        element.clientWidth,
        element.scrollWidth,
        element.scrollLeft,
      ),
    );
  }, []);

  useEffect(() => {
    const element = initialFilterScrollRef.current;
    if (!element) return;

    updateInitialFilterIndicator();
    element.addEventListener("scroll", updateInitialFilterIndicator, {
      passive: true,
    });
    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(updateInitialFilterIndicator);
    resizeObserver?.observe(element);
    if (element.firstElementChild)
      resizeObserver?.observe(element.firstElementChild);

    return () => {
      element.removeEventListener("scroll", updateInitialFilterIndicator);
      resizeObserver?.disconnect();
    };
  }, [updateInitialFilterIndicator]);

  useEffect(() => {
    if (showRandomProfiles) onRandomReveal(visibleProfiles.length);
  }, [
    onRandomReveal,
    randomWindowStart,
    showRandomProfiles,
    visibleProfiles.length,
  ]);

  const handleQueryChange = (nextQuery: string) => {
    if (showRandomProfiles) {
      setRandomWindowStart((current) =>
        advanceBaristaDirectoryRandomWindowStart(
          current,
          visibleProfiles.length,
          true,
          randomProfiles.length,
        ),
      );
    }
    onQueryChange(nextQuery);
  };

  const handleInitialSelect = (initial: DirectoryInitialFilter) => {
    if (selectedInitial === initial) return;

    if (showRandomProfiles && initial !== "전체") {
      setRandomWindowStart((current) =>
        advanceBaristaDirectoryRandomWindowStart(
          current,
          visibleProfiles.length,
          true,
          randomProfiles.length,
        ),
      );
    }
    setSelectedInitial(initial);
  };

  const subtitle =
    query.trim() || selectedInitial !== "전체"
      ? `검색 결과 ${filteredProfiles.length}명`
      : `등록된 바리스타 총 ${totalCount}명`;

  return (
    <section className="barista-directory-panel fixed inset-0 z-[200] mx-auto flex max-w-[var(--app-shell-max-width)] origin-top-right flex-col bg-[var(--bg)] shadow-[var(--shadow-modal)]">
      <div className="shrink-0 border-b border-[var(--border)] bg-[var(--surface)]/95 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="grid h-16 grid-cols-[56px_1fr_56px] items-center px-2">
          <button
            type="button"
            aria-label="뒤로가기"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center text-[var(--fg)]"
          >
            <ArrowLeft size={25} strokeWidth={2.2} />
          </button>
          <Link
            prefetch={false}
            href="/home"
            className="logo-wordmark text-center text-[25px] font-bold text-[var(--fg-strong)]"
          >
            BLENDING
          </Link>
          <span aria-hidden className="h-11 w-11" />
        </div>

        <div className="px-5 pb-4">
          <h2 className="text-[20px] font-bold tracking-[-0.01em] text-[var(--fg-strong)]">
            바리스타 인물사전
          </h2>
          <p className="mt-1 text-[13px] leading-[1.5] text-[var(--fg-muted)]">
            {subtitle}
          </p>
          <label className="mt-4 flex h-12 items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--border-strong)] px-4 focus-within:border-[var(--accent)]">
            <Search
              size={22}
              strokeWidth={2}
              className="text-[var(--fg-subtle)]"
            />
            <input
              name="baristaDirectorySearch"
              aria-label="카페 또는 바리스타 검색"
              value={query}
              onChange={(event) => handleQueryChange(event.target.value)}
              placeholder="카페 또는 바리스타 검색"
              enterKeyHint="search"
              className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-[var(--fg-subtle)]"
            />
            {query ? (
              <button
                type="button"
                aria-label="검색어 지우기"
                onClick={() => handleQueryChange("")}
                className="flex h-8 w-8 items-center justify-center text-[var(--fg-muted)]"
              >
                <X size={18} strokeWidth={2.1} />
              </button>
            ) : null}
          </label>
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              aria-pressed={selectedInitial === "전체"}
              onClick={() => handleInitialSelect("전체")}
              className={`shrink-0 text-[14px] ${
                selectedInitial === "전체"
                  ? "font-bold text-[var(--fg-strong)]"
                  : "font-medium text-[var(--fg-muted)]"
              }`}
            >
              전체
            </button>
            <div className="min-w-0 flex-1">
              <div
                ref={initialFilterScrollRef}
                className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                <div className="flex w-max gap-2">
                  {DIRECTORY_INITIAL_FILTERS.slice(1).map((initial) => {
                    const selected = selectedInitial === initial;
                    const autoWidth = initial === "A–Z" ? "px-3" : "w-10";
                    return (
                      <button
                        key={initial}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => handleInitialSelect(initial)}
                        className={
                          selected
                            ? `flex h-10 shrink-0 items-center justify-center rounded-[var(--radius-pill)] bg-[var(--surface-alt)] ${autoWidth} text-[14px] font-bold text-[var(--accent)]`
                            : `flex h-10 shrink-0 items-center justify-center rounded-[var(--radius-pill)] bg-[var(--surface-alt)] ${autoWidth} text-[14px] font-medium text-[var(--fg-muted)]`
                        }
                      >
                        {initial}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div
                aria-hidden
                className="relative mt-2 h-1 rounded-[var(--radius-pill)] bg-[var(--border)]"
              >
                <span
                  className="absolute inset-y-0 left-0 rounded-[var(--radius-pill)] bg-[var(--fg-muted)]"
                  style={{
                    transform: `translateX(${initialFilterIndicator.offset}px)`,
                    width: `${initialFilterIndicator.thumbWidth}px`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-2 pb-[calc(var(--app-bottom-nav-height)+24px)]">
        {visibleProfiles.length === 0 ? (
          <div className="flex min-h-[180px] items-center justify-center text-center">
            <div>
              <p className="text-[16px] font-bold text-[var(--fg-strong)]">
                검색 결과가 없습니다
              </p>
              <p className="mt-2 text-[13px] leading-[1.6] text-[var(--fg-muted)]">
                카페명 또는 바리스타명을 다시 입력해 주세요.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-x-3 gap-y-4 sm:gap-x-4">
            {visibleProfiles.map((profile) => {
              const workplace = getDirectoryMatchedWorkplace(profile, query);

              return (
                <button
                  key={profile.profileId}
                  type="button"
                  aria-label={`${profile.name}, ${workplace} 프로필 보기`}
                  onClick={() => onProfileSelect(profile)}
                  className="min-w-0 text-center transition active:scale-[0.98]"
                >
                  <Avatar
                    src={profile.avatarUrl}
                    alt=""
                    size="fluid"
                    highlighted={Boolean(profile.badgeName)}
                    dashed={!profile.badgeName}
                    badgeName={profile.badgeName}
                    icon={<UserRound size={34} strokeWidth={1.7} />}
                    className="mx-auto"
                  />
                  <span className="mt-3 block truncate text-[16px] font-bold leading-[1.4] text-[var(--fg-strong)]">
                    {profile.name}
                  </span>
                  <span
                    aria-hidden
                    className="mx-auto mt-1 block h-px w-6 bg-[var(--accent)]"
                  />
                  <span className="mt-1 block truncate text-[13px] leading-[1.5] text-[var(--fg-muted)]">
                    {workplace}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function StaticMapFallback() {
  const roadLines = useMemo(
    () => [
      "left-[-12%] top-[22%] h-[2px] w-[135%] rotate-[17deg]",
      "left-[-18%] top-[54%] h-[2px] w-[140%] rotate-[-14deg]",
      "left-[16%] top-[8%] h-[2px] w-[112%] rotate-[72deg]",
      "left-[8%] top-[72%] h-[2px] w-[118%] rotate-[29deg]",
      "left-[58%] top-[2%] h-[2px] w-[92%] rotate-[102deg]",
      "left-[-8%] top-[41%] h-[2px] w-[82%] rotate-[86deg]",
    ],
    [],
  );

  return (
    <div className="absolute inset-0 overflow-hidden bg-[var(--surface-alt)] text-[var(--fg-muted)]">
      <div className="absolute inset-0 opacity-75">
        {roadLines.map((className, index) => (
          <span
            key={index}
            className={`absolute rounded-[var(--radius-pill)] bg-[var(--border-strong)] ${className}`}
          />
        ))}
        <span className="absolute left-[-10%] top-[61%] h-16 w-[120%] rotate-[-11deg] rounded-[var(--radius-pill)] bg-[var(--border)]" />
        <span className="absolute left-[8%] top-[19%] text-[20px] font-bold leading-none text-[var(--fg-subtle)]">
          JONGNO-GU
        </span>
        <span className="absolute left-[52%] top-[13%] text-[17px] font-bold leading-none text-[var(--fg-subtle)]">
          SEONGBUK-GU
        </span>
        <span className="absolute left-[18%] top-[43%] text-[50px] font-bold leading-none text-[var(--fg)] opacity-70">
          Seoul
        </span>
        <span className="absolute left-[32%] top-[52%] text-[16px] font-bold leading-none text-[var(--fg-subtle)]">
          YONGSAN-GU
        </span>
        <span className="absolute left-[63%] top-[65%] text-[16px] font-bold leading-none text-[var(--fg-subtle)]">
          GANGNAM-GU
        </span>
      </div>
    </div>
  );
}

function PermissionModal({
  context,
  status,
  onClose,
  onOpenSettings,
  onRetry,
}: {
  context: LocationPermissionContext;
  status: LocationStatus;
  onClose: () => void;
  onOpenSettings: () => void;
  onRetry: () => void;
}) {
  const isNativePermission = context.source === "native";
  const shouldOpenSettings =
    isNativePermission && status === "denied" && context.canAskAgain === false;
  const description = isNativePermission
    ? "앱 설정에서 위치 권한을 허용한 뒤 다시 시도해 주세요."
    : "브라우저 설정에서 위치 권한을 허용한 뒤 다시 시도해 주세요.";
  const actionLabel = shouldOpenSettings ? "설정 열기" : "다시 시도";
  const handleAction = shouldOpenSettings ? onOpenSettings : onRetry;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-[rgba(0,0,0,0.4)] px-6">
      <section className="w-full max-w-[360px] rounded-[var(--radius-xl)] bg-[var(--surface)] p-5 shadow-[var(--shadow-modal)]">
        <h2 className="text-[20px] font-bold leading-[1.35] text-[var(--fg-strong)]">
          위치 권한 필요
        </h2>
        <p className="mt-3 text-[15px] leading-[1.65] text-[var(--fg)]">
          내 주변 바리스타를 찾기 위해 위치 권한이 필요합니다.
        </p>
        <p className="mt-2 text-[13px] leading-[1.55] text-[var(--fg-muted)]">
          {description}
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[var(--radius-lg)] border border-[var(--border-strong)] py-4 text-[16px] font-bold text-[var(--fg)] transition active:scale-[0.98]"
          >
            닫기
          </button>
          <button
            type="button"
            onClick={handleAction}
            className="rounded-[var(--radius-lg)] bg-[var(--accent)] py-4 text-[16px] font-bold text-white transition active:scale-[0.98]"
          >
            {actionLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
