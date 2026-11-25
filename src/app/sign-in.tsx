import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Text, View } from 'react-native';
import { z } from 'zod';
import { AuthTopBar, DevelopmentNotice, InlineAlert, PrimaryButton, ScreenShell, TextField } from '@/components/ui';
import { useSessionStore } from '@/store/sessionStore';
import { authService } from '@/services/authService';
import { isDevelopmentPreview } from '@/services/apiClient';
import { colors } from '@/theme/tokens';

const signInSchema = z.object({ email: z.string().trim().email('Enter a valid email address.'), password: z.string().min(1, 'Enter your password.') });
type SignInValues = z.infer<typeof signInSchema>;

export default function SignInScreen() {
  const setSession = useSessionStore((state) => state.setSession);
  const [requestError, setRequestError] = useState('');
  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema), defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setRequestError('');
    try {
      const session = await authService.signIn(values.email, values.password);
      setSession(session);
      router.replace(session.mode === 'development' ? '/profile-setup' : '/(patient)/home');
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : 'We could not sign you in. Please try again.');
    }
  });

  return (
    <ScreenShell>
      <AuthTopBar onBack={() => router.back()} />
      <View style={{ marginTop: 16, marginBottom: 30 }}>
        <Text style={{ color: colors.teal, fontSize: 11, fontWeight: '700', letterSpacing: 1.4 }}>WELCOME BACK</Text>
        <Text style={{ color: colors.ink, fontSize: 33, lineHeight: 40, fontWeight: '700', letterSpacing: -1.1, marginTop: 10 }}>Good to see you.</Text>
        <Text style={{ color: colors.inkSoft, fontSize: 14, lineHeight: 21, marginTop: 8 }}>Sign in to continue your care journey.</Text>
      </View>

      {requestError ? <InlineAlert>{requestError}</InlineAlert> : null}
      <Controller control={control} name="email" render={({ field }) => (
        <TextField label="Email address" placeholder="you@example.com" icon="mail" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.email?.message} />
      )} />
      <Controller control={control} name="password" render={({ field }) => (
        <TextField label="Password" placeholder="Enter your password" icon="lock" secureTextEntry value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.password?.message} />
      )} />
      <Text accessibilityRole="link" onPress={() => router.push('/forgot-password')} style={{ alignSelf: 'flex-end', color: colors.blue, fontSize: 12, fontWeight: '700', marginTop: -3, marginBottom: 22 }}>Forgot password?</Text>
      {isDevelopmentPreview ? <DevelopmentNotice>Development preview: sign-in is local and does not verify or create a real account.</DevelopmentNotice> : null}
      <PrimaryButton label="Sign in" loading={isSubmitting} onPress={() => onSubmit()} style={{ marginTop: 10 }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 25 }}>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.line }} />
        <Text style={{ color: colors.muted, fontSize: 11 }}>SECURE PATIENT ACCESS</Text>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.line }} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
        <Text style={{ color: colors.muted, fontSize: 13 }}>New to MedKnot?</Text>
        <Text accessibilityRole="link" onPress={() => router.push('/register')} style={{ color: colors.blue, fontSize: 13, fontWeight: '700' }}>Create account</Text>
      </View>
    </ScreenShell>
  );
}
