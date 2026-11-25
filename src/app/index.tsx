import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { BrandMark } from '@/components/ui';
import { useSessionStore } from '@/store/sessionStore';
import { colors } from '@/theme/tokens';

export default function SplashScreen() {
  const authReady = useSessionStore((state) => state.authReady);
  const [reducedMotion, setReducedMotion] = useState(false);
  const markReveal = useSharedValue(0);
  const wordReveal = useSharedValue(0);
  const taglineReveal = useSharedValue(0);
  const markStyle = useAnimatedStyle(() => ({
    opacity: markReveal.get(),
    transform: [{ scale: 0.84 + markReveal.get() * 0.16 }, { rotate: `${(1 - markReveal.get()) * -8}deg` }],
  }));
  const wordStyle = useAnimatedStyle(() => ({ opacity: wordReveal.get(), transform: [{ translateY: (1 - wordReveal.get()) * 8 }] }));
  const taglineStyle = useAnimatedStyle(() => ({ opacity: taglineReveal.get(), transform: [{ translateY: (1 - taglineReveal.get()) * 5 }] }));

  useEffect(() => {
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    void AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion).catch(() => undefined);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    markReveal.set(withTiming(1, { duration: reducedMotion ? 1 : 560, easing: Easing.out(Easing.cubic) }));
    wordReveal.set(withDelay(reducedMotion ? 0 : 150, withTiming(1, { duration: reducedMotion ? 1 : 380, easing: Easing.out(Easing.cubic) })));
    taglineReveal.set(withDelay(reducedMotion ? 0 : 380, withTiming(1, { duration: reducedMotion ? 1 : 340, easing: Easing.out(Easing.cubic) })));
  }, [reducedMotion, markReveal, wordReveal, taglineReveal]);

  useEffect(() => {
    if (!authReady) return;
    const timer = setTimeout(() => {
      const session = useSessionStore.getState().session;
      router.replace(session ? '/(patient)/home' : '/welcome');
    }, reducedMotion ? 500 : 1_550);
    return () => clearTimeout(timer);
  }, [authReady, reducedMotion]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[markStyle, { marginBottom: 20 }]}><BrandMark size={86} /></Animated.View>
      <Animated.Text style={[wordStyle, { color: colors.ink, fontSize: 31, letterSpacing: -1.2, textAlign: 'center', fontWeight: '700' }]}>MedKnot</Animated.Text>
      <Animated.Text style={[taglineStyle, { color: colors.inkSoft, fontSize: 14, letterSpacing: 0.25, textAlign: 'center', marginTop: 7 }]}>Connected care. Brighter lives.</Animated.Text>
      <View style={{ position: 'absolute', bottom: 54 }}>
        <Text style={{ color: colors.muted, fontSize: 9, fontWeight: '700', letterSpacing: 2.2 }}>YOUR HEALTHCARE, CONNECTED</Text>
      </View>
    </View>
  );
}
