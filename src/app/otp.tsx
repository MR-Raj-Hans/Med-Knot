import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { AuthTopBar, DevelopmentNotice, InlineAlert, PrimaryButton, ScreenShell } from '@/components/ui';
import { authService } from '@/services/authService';
import { isBackendConfigured } from '@/services/apiClient';
import { useSessionStore } from '@/store/sessionStore';
import { colors } from '@/theme/tokens';

export default function OtpScreen() {
  const pending = useSessionStore((state) => state.pendingVerification);
  const setPending = useSessionStore((state) => state.setPendingVerification);
  const clearPending = useSessionStore((state) => state.clearPendingVerification);
  const setSession = useSessionStore((state) => state.setSession);
  const [code, setCode] = useState('');
  const [countdown, setCountdown] = useState(28);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((value) => value - 1), 1_000);
    return () => clearTimeout(timer);
  }, [countdown]);

  useEffect(() => {
    if (!pending) router.replace('/register');
  }, [pending]);

  if (!pending) return null;

  const handleVerify = async () => {
    if (code.length !== 6) {
      setError('Enter all six digits to continue.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const session = await authService.verifyCode(pending, code);
      setSession(session);
      clearPending();
      router.replace('/profile-setup');
    } catch (verificationError) {
      setError(verificationError instanceof Error ? verificationError.message : 'We could not verify that code. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setMessage('');
    try {
      const nextPending = await authService.resendCode(pending);
      setPending(nextPending);
      setCountdown(28);
      setCode('');
      setMessage(nextPending.mode === 'development' ? 'A new development code is ready.' : 'A new code has been sent.');
    } catch (resendError) {
      setError(resendError instanceof Error ? resendError.message : 'Could not send a new code. Try again.');
    }
  };

  return (
    <ScreenShell>
      <AuthTopBar onBack={() => router.back()} rightLabel="02 / 02" />
      <View style={{ width: 62, height: 62, borderRadius: 21, backgroundColor: colors.tealPale, alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
        <Feather name="shield" size={25} color={colors.teal} />
      </View>
      <Text style={{ color: colors.teal, fontSize: 11, fontWeight: '700', letterSpacing: 1.45 }}>A QUICK SECURITY CHECK</Text>
      <Text style={{ color: colors.ink, fontSize: 31, lineHeight: 38, fontWeight: '700', letterSpacing: -0.9, marginTop: 9 }}>Verify your email</Text>
      <Text style={{ color: colors.inkSoft, fontSize: 14, lineHeight: 21, marginTop: 8, marginBottom: 25 }}>
        Enter the six-digit code sent to{'\n'}<Text style={{ color: colors.ink, fontWeight: '700' }}>{pending.email}</Text>
      </Text>

      {error ? <InlineAlert>{error}</InlineAlert> : null}
      {message ? <InlineAlert tone="success">{message}</InlineAlert> : null}
      <View style={{ position: 'relative', marginBottom: 18 }}>
        <View pointerEvents="none" style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
          {Array.from({ length: 6 }, (_, index) => (
            <View key={index} style={{ flex: 1, height: 58, borderRadius: 15, borderWidth: 1, borderColor: code.length === index ? colors.teal : colors.line, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: colors.ink, fontWeight: '700', fontSize: 22 }}>{code[index] ?? ''}</Text>
            </View>
          ))}
        </View>
        <TextInput
          value={code}
          onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          maxLength={6}
          autoFocus
          accessibilityLabel="Six-digit verification code"
          style={{ position: 'absolute', inset: 0, opacity: 0.02, color: 'transparent' }}
        />
      </View>
      <Text style={{ alignSelf: 'center', color: colors.blue, fontSize: 12, fontWeight: '700', marginBottom: 18 }}>Enter the code using your number keyboard.</Text>
      {pending.mode === 'development' ? <DevelopmentNotice>{isBackendConfigured ? `Local server verification code: ${pending.demoCode}. This code is stored only for this development server.` : `Development preview code: ${pending.demoCode}. It does not represent server verification.`}</DevelopmentNotice> : null}
      <PrimaryButton label="Verify and continue" loading={busy} onPress={handleVerify} style={{ marginTop: 10 }} />
      <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5, marginTop: 23 }}>
        <Text style={{ color: colors.muted, fontSize: 13 }}>Didn&apos;t receive it?</Text>
        <Text accessibilityRole="link" onPress={countdown === 0 ? handleResend : undefined} style={{ color: countdown === 0 ? colors.blue : colors.muted, fontWeight: '700', fontSize: 13 }}>
          {countdown === 0 ? 'Resend code' : `Resend in 0:${String(countdown).padStart(2, '0')}`}
        </Text>
      </View>
    </ScreenShell>
  );
}
