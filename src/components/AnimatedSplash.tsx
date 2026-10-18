import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

interface Props {
  onFinish: () => void;
}

export default function AnimatedSplash({ onFinish }: Props) {
  const brandOpacity = useRef(new Animated.Value(0)).current;
  const brandScale = useRef(new Animated.Value(0.94)).current;
  const brandY = useRef(new Animated.Value(14)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const taglineY = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    const animation = Animated.sequence([
      Animated.parallel([
        Animated.timing(brandOpacity, {
          toValue: 1,
          duration: 650,
          useNativeDriver: true,
        }),
        Animated.spring(brandScale, {
          toValue: 1,
          friction: 7,
          tension: 65,
          useNativeDriver: true,
        }),
        Animated.timing(brandY, {
          toValue: 0,
          duration: 650,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(taglineOpacity, {
          toValue: 1,
          duration: 450,
          useNativeDriver: true,
        }),
        Animated.timing(taglineY, {
          toValue: 0,
          duration: 450,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(1100),
      Animated.timing(brandOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]);

    animation.start(({ finished }) => {
      if (finished) onFinish();
    });

    return () => animation.stop();
  }, [brandOpacity, brandScale, brandY, taglineOpacity, taglineY, onFinish]);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.brandBlock,
          {
            opacity: brandOpacity,
            transform: [{ scale: brandScale }, { translateY: brandY }],
          },
        ]}
      >
        <Text style={styles.title}>RivoCity</Text>
      </Animated.View>

      <Animated.Text
        style={[
          styles.tagline,
          { opacity: taglineOpacity, transform: [{ translateY: taglineY }] },
        ]}
      >
        One City. Infinite Possibilities.
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#16A34A",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  brandBlock: {
    alignItems: "center",
  },
  title: {
    color: "#FFFFFF",
    fontSize: 38,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  tagline: {
    marginTop: 12,
    color: "rgba(255,255,255,0.92)",
    fontSize: 14,
    fontWeight: "500",
    letterSpacing: 0.3,
    textAlign: "center",
  },
});
