import { Feather } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radii, shadows, spacing } from '@/theme/tokens';

type IconName = React.ComponentProps<typeof Feather>['name'];

export function ScreenShell({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top', 'left', 'right']} style={styles.safeArea}>
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={styles.screenContent}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function BrandMark({ size = 46 }: { size?: number }) {
  return (
    <View
      accessible
      accessibilityLabel="MedKnot mark"
      style={[styles.mark, { width: size, height: size, borderRadius: size * 0.33 }]}
    >
      <View style={[styles.markHorizontal, { width: size * 0.56, height: size * 0.13, borderRadius: size }]} />
      <View style={[styles.markVertical, { width: size * 0.13, height: size * 0.56, borderRadius: size }]} />
      <View style={[styles.markDot, { width: size * 0.14, height: size * 0.14, borderRadius: size }]} />
    </View>
  );
}

export function Wordmark({ size = 'regular', light = false }: { size?: 'regular' | 'large'; light?: boolean }) {
  return (
    <View style={styles.wordmarkRow}>
      <BrandMark size={size === 'large' ? 54 : 40} />
      <View>
        <Text style={[styles.wordmark, size === 'large' && styles.wordmarkLarge, light && styles.textWhite]}>MedKnot</Text>
        <Text style={[styles.wordmarkTag, light && styles.tagLight]}>CONNECTED CARE</Text>
      </View>
    </View>
  );
}

export function AppText({
  children,
  variant = 'body',
  color,
  style,
  ...props
}: React.ComponentProps<typeof Text> & { variant?: 'body' | 'small' | 'eyebrow' | 'title' | 'heading'; color?: string }) {
  return (
    <Text
      {...props}
      style={[
        styles.body,
        variant === 'small' && styles.small,
        variant === 'eyebrow' && styles.eyebrow,
        variant === 'title' && styles.title,
        variant === 'heading' && styles.heading,
        color ? { color } : null,
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function IconButton({
  name,
  onPress,
  accessibilityLabel,
  tint = colors.ink,
  size = 19,
  style,
}: {
  name: IconName;
  onPress: () => void;
  accessibilityLabel: string;
  tint?: string;
  size?: number;
  style?: object;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, style, pressed && styles.pressed]}
    >
      <Feather name={name} size={size} color={tint} />
    </Pressable>
  );
}

export function PrimaryButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  icon,
  style,
  ...props
}: {
  label: string;
  onPress: PressableProps['onPress'];
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'quiet' | 'dark';
  icon?: IconName;
  style?: object;
}) {
  const isPrimary = variant === 'primary' || variant === 'dark';
  const foreground = variant === 'secondary' ? colors.ink : isPrimary ? colors.paper : colors.blueDeep;
  const background = variant === 'primary' ? colors.blue : variant === 'dark' ? colors.ink : 'transparent';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: background, borderColor: variant === 'secondary' ? colors.line : background },
        variant === 'quiet' && styles.quietButton,
        disabled && styles.disabledButton,
        pressed && !disabled && styles.pressed,
        style,
      ]}
      {...props}
    >
      {loading ? <ActivityIndicator color={foreground} /> : <>
        {icon ? <Feather name={icon} size={17} color={foreground} style={styles.buttonIcon} /> : null}
        <Text style={[styles.buttonLabel, { color: foreground }]}>{label}</Text>
        <Feather name="arrow-right" size={17} color={foreground} style={styles.buttonArrow} />
      </>}
    </Pressable>
  );
}

export function TextField({
  label,
  error,
  hint,
  icon,
  style,
  ...props
}: TextInputProps & { label: string; error?: string; hint?: string; icon?: IconName; style?: object }) {
  return (
    <View style={[styles.fieldWrap, style]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.inputShell, error && styles.inputError]}>
        {icon ? <Feather name={icon} size={17} color={colors.muted} style={styles.inputIcon} /> : null}
        <TextInput
          {...props}
          placeholderTextColor={colors.muted}
          style={styles.input}
          accessibilityLabel={props.accessibilityLabel ?? label}
        />
      </View>
      {error ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}
      {!error && hint ? <Text style={styles.hintText}>{hint}</Text> : null}
    </View>
  );
}

export function AuthTopBar({ onBack, rightLabel }: { onBack?: () => void; rightLabel?: string }) {
  return (
    <View style={styles.authTopBar}>
      {onBack ? <IconButton name="arrow-left" onPress={onBack} accessibilityLabel="Go back" /> : <View style={{ width: 44 }} />}
      <Wordmark />
      <View style={styles.topRight}>
        {rightLabel ? <Text style={styles.topRightText}>{rightLabel}</Text> : <View style={{ width: 44 }} />}
      </View>
    </View>
  );
}

export function SectionHeading({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action ? <Pressable onPress={onAction} accessibilityRole="button"><Text style={styles.linkText}>{action}</Text></Pressable> : null}
    </View>
  );
}

export function DevelopmentNotice({ children }: { children: ReactNode }) {
  return (
    <View style={styles.notice}>
      <Feather name="info" color={colors.blueDeep} size={16} />
      <Text style={styles.noticeText}>{children}</Text>
    </View>
  );
}

export function InlineAlert({ children, tone = 'danger' }: { children: ReactNode; tone?: 'danger' | 'success' }) {
  return (
    <View style={[styles.alert, tone === 'success' && styles.successAlert]} accessibilityRole="alert">
      <Feather name={tone === 'success' ? 'check-circle' : 'alert-circle'} color={tone === 'success' ? colors.teal : colors.danger} size={16} />
      <Text style={[styles.alertText, tone === 'success' && styles.successText]}>{children}</Text>
    </View>
  );
}

export function Panel({ children, style }: { children: ReactNode; style?: object }) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

export function Avatar({ name, imageUri, size = 48 }: { name: string; imageUri?: string; size?: number }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'M';
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      {imageUri ? <Image source={{ uri: imageUri }} style={{ width: size, height: size, borderRadius: size / 2 }} /> : <Text style={[styles.avatarText, { fontSize: size * 0.34 }]}>{initials}</Text>}
    </View>
  );
}

export function ChoiceChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.choiceChip, selected && styles.choiceSelected]}
    >
      <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.canvas },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 30 },
  screenContent: { flex: 1, paddingHorizontal: 24 },
  mark: { backgroundColor: colors.blueDeep, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  markHorizontal: { position: 'absolute', backgroundColor: '#FFFFFF' },
  markVertical: { position: 'absolute', backgroundColor: '#FFFFFF' },
  markDot: { backgroundColor: colors.lime, position: 'absolute', right: '17%', top: '17%', borderWidth: 2, borderColor: colors.blueDeep },
  wordmarkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  wordmark: { fontSize: 18, lineHeight: 21, color: colors.ink, fontWeight: '700', letterSpacing: -0.55 },
  wordmarkLarge: { fontSize: 23, lineHeight: 28 },
  wordmarkTag: { fontSize: 7.5, color: colors.muted, letterSpacing: 1.65, fontWeight: '700', marginTop: 3 },
  textWhite: { color: '#FFFFFF' },
  tagLight: { color: 'rgba(255,255,255,0.66)' },
  body: { color: colors.ink, fontSize: 15, lineHeight: 22 },
  small: { fontSize: 13, lineHeight: 19, color: colors.inkSoft },
  eyebrow: { fontSize: 11, lineHeight: 15, color: colors.teal, fontWeight: '700', letterSpacing: 1.45, textTransform: 'uppercase' },
  title: { fontSize: 34, lineHeight: 40, color: colors.ink, fontWeight: '700', letterSpacing: -1.1 },
  heading: { fontSize: 23, lineHeight: 29, color: colors.ink, fontWeight: '700', letterSpacing: -0.5 },
  iconButton: { width: 44, height: 44, borderRadius: 16, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  button: { minHeight: 56, paddingHorizontal: 20, borderRadius: 18, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  quietButton: { borderColor: 'transparent' },
  disabledButton: { opacity: 0.5 },
  buttonIcon: { marginRight: 9 },
  buttonLabel: { fontWeight: '700', fontSize: 15.5, letterSpacing: 0.1 },
  buttonArrow: { marginLeft: 10 },
  fieldWrap: { gap: 8, marginBottom: 16 },
  fieldLabel: { color: colors.ink, fontSize: 13, fontWeight: '700', marginLeft: 2 },
  inputShell: { height: 56, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: 16, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 },
  inputError: { borderColor: colors.danger },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, minWidth: 0, color: colors.ink, paddingVertical: 0, fontSize: 15 },
  errorText: { color: colors.danger, fontSize: 12, marginLeft: 2 },
  hintText: { color: colors.muted, fontSize: 12, marginLeft: 2 },
  authTopBar: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 30 },
  topRight: { width: 44, alignItems: 'flex-end' },
  topRightText: { fontSize: 12, color: colors.inkSoft, fontWeight: '600' },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sectionTitle: { fontSize: 18, lineHeight: 24, fontWeight: '700', color: colors.ink, letterSpacing: -0.25 },
  linkText: { color: colors.blue, fontSize: 13, fontWeight: '700' },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 15, backgroundColor: '#ECF3F4', padding: 14, marginVertical: 8 },
  noticeText: { flex: 1, color: colors.blueDeep, fontSize: 12, lineHeight: 18 },
  alert: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 14, backgroundColor: colors.dangerPale, padding: 12, marginBottom: 14 },
  alertText: { flex: 1, fontSize: 12, lineHeight: 18, color: colors.danger, fontWeight: '600' },
  successAlert: { backgroundColor: colors.tealPale },
  successText: { color: colors.teal },
  panel: { backgroundColor: colors.paper, padding: spacing.lg, borderRadius: radii.lg, borderWidth: 1, borderColor: 'rgba(228,234,232,0.8)', ...shadows.card },
  avatar: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.tealPale, overflow: 'hidden' },
  avatarText: { color: colors.teal, fontWeight: '700' },
  choiceChip: { minHeight: 44, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  choiceSelected: { backgroundColor: colors.tealPale, borderColor: colors.teal },
  choiceText: { color: colors.inkSoft, fontSize: 12, fontWeight: '600' },
  choiceTextSelected: { color: colors.teal, fontWeight: '700' },
});
