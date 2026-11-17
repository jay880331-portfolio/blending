import { useEffect, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  StyleSheet,
} from "react-native";
import Svg, { Rect } from "react-native-svg";

import {
  LETTER_FADE_MS,
  LETTER_PATTERNS,
  LETTER_STAGGER_MS,
  MIN_SPLASH_DURATION_MS,
  remainingSplashDuration,
  SIP_POSE_MS,
  SPLASH_FADE_MS,
  SPLASH_LOOP_MS,
  sipPoseAt,
} from "./splashTiming";

const CELL_SIZE = 10;
const CELL_GAP = 1;
const REDUCED_MOTION_FADE_MS = 50;
const SPLASH_IMAGES = [
  require("../assets/splash-baristas-rest.png"),
  require("../assets/splash-baristas-mid.png"),
  require("../assets/splash-baristas-sip.png"),
] as const;

type SplashOverlayProps = {
  ready: boolean;
  onHidden: () => void;
  onLayout: () => void;
};

function PixelLetter({
  opacity,
  pattern,
}: {
  opacity: Animated.Value;
  pattern: string;
}) {
  const rows = pattern.split("/");
  const columns = rows[0].length;
  const step = CELL_SIZE + CELL_GAP;

  return (
    <Animated.View style={{ opacity }}>
      <Svg
        height={rows.length * step - CELL_GAP}
        width={columns * step - CELL_GAP}
      >
        {rows.flatMap((row, rowIndex) =>
          [...row].map((cell, columnIndex) =>
            cell === "1" ? (
              <Rect
                key={`${rowIndex}-${columnIndex}`}
                fill="#000000"
                height={CELL_SIZE}
                width={CELL_SIZE}
                x={columnIndex * step}
                y={rowIndex * step}
              />
            ) : null,
          ),
        )}
      </Svg>
    </Animated.View>
  );
}

export function SplashOverlay({
  ready,
  onHidden,
  onLayout,
}: SplashOverlayProps) {
  const [startedAt] = useState(() => Date.now());
  const [overlayOpacity] = useState(() => new Animated.Value(1));
  const [letterOpacities] = useState(() =>
    LETTER_PATTERNS.map(() => new Animated.Value(0)),
  );
  const [reducedMotion, setReducedMotion] = useState<boolean | null>(null);
  const [sipPoseTick, setSipPoseTick] = useState(0);

  useEffect(() => {
    let mounted = true;

    void AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setReducedMotion(enabled);
      })
      .catch(() => {
        if (mounted) setReducedMotion(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (reducedMotion !== false) return;

    const interval = setInterval(
      () => setSipPoseTick((tick) => tick + 1),
      SIP_POSE_MS,
    );

    return () => {
      clearInterval(interval);
      setSipPoseTick(0);
    };
  }, [reducedMotion]);

  useEffect(() => {
    if (reducedMotion === null) return;

    if (reducedMotion) {
      letterOpacities.forEach((opacity) => opacity.setValue(1));
      return;
    }

    const revealDuration =
      (LETTER_PATTERNS.length - 1) * LETTER_STAGGER_MS + LETTER_FADE_MS;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.parallel(
          letterOpacities.map((opacity) =>
            Animated.timing(opacity, {
              duration: 0,
              toValue: 0,
              useNativeDriver: true,
            }),
          ),
        ),
        Animated.stagger(
          LETTER_STAGGER_MS,
          letterOpacities.map((opacity) =>
            Animated.timing(opacity, {
              duration: LETTER_FADE_MS,
              easing: Easing.out(Easing.quad),
              toValue: 1,
              useNativeDriver: true,
            }),
          ),
        ),
        Animated.delay(SPLASH_LOOP_MS - revealDuration),
      ]),
      { resetBeforeIteration: false },
    );

    animation.start();
    return () => animation.stop();
  }, [letterOpacities, reducedMotion]);

  useEffect(() => {
    if (!ready || reducedMotion === null) return;

    const delay = reducedMotion
      ? 0
      : remainingSplashDuration(startedAt, Date.now(), MIN_SPLASH_DURATION_MS);
    const timeout = setTimeout(() => {
      Animated.timing(overlayOpacity, {
        duration: reducedMotion ? REDUCED_MOTION_FADE_MS : SPLASH_FADE_MS,
        easing: Easing.out(Easing.quad),
        toValue: 0,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) onHidden();
      });
    }, delay);

    return () => clearTimeout(timeout);
  }, [onHidden, overlayOpacity, ready, reducedMotion, startedAt]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={onLayout}
      style={[styles.overlay, { opacity: overlayOpacity }]}
    >
      <Animated.View style={styles.wordmark}>
        {LETTER_PATTERNS.map((pattern, index) => (
          <PixelLetter
            key={`${pattern}-${index}`}
            opacity={letterOpacities[index]}
            pattern={pattern}
          />
        ))}
      </Animated.View>
      <Image
        accessible={false}
        resizeMode="contain"
        source={SPLASH_IMAGES[sipPoseAt(sipPoseTick, reducedMotion !== false)]}
        style={styles.illustration}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    bottom: 0,
    justifyContent: "center",
    left: 0,
    paddingHorizontal: 16,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 10,
  },
  wordmark: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    marginBottom: 24,
  },
  illustration: {
    aspectRatio: 1,
    maxWidth: 400,
    width: "100%",
  },
});
