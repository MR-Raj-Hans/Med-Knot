import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Text, View } from 'react-native';
import { z } from 'zod';
import { AuthTopBar, DevelopmentNotice, InlineAlert, PrimaryButton, ScreenShell, TextField } from '@/components/ui';
import { authService } from '@/services/authService';
import { colors } from '@/theme/tokens';

const schema = z.object({ email: z.string().trim().email('Enter a valid email address.') });
type Values = z.infer<typeof schema>;

export default function ForgotPasswordScreen() {
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: '' } });
  const submit = handleSubmit(async ({ email }) => {
    setError('');
    try {
      const result = await authService.requestPasswordReset(email);
      setNotice(result.mode === 'development'
        ? 'This development flow is ready, but it cannot reset a real password until the backend is connected.'
        : 'If an account matches that email, recovery instructions have been sent.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not request a reset. Please try again.');
    }
  });

  return (
    <ScreenShell>
      <AuthTopBar onBack={() => router.back()} />
      <View style={{ width: 62, height: 62, borderRadius: 21, backgroundColor: colors.tealPale, alignItems: 'center', justifyContent: 'center', marginTop: 20, marginBottom: 24 }}>
        <Text style={{ fontSize: 25, color: colors.teal }}>↗</Text>
      </View>
      <Text style={{ color: colors.teal, fontSize: 11, fontWeight: '700', letterSpacing: 1.4 }}>ACCOUNT RECOVERY</Text>
      <Text style={{ color: colors.ink, fontSize: 31, lineHeight: 38, fontWeight: '700', letterSpacing: -0.9, marginTop: 9 }}>Reset your password</Text>
      <Text style={{ color: colors.inkSoft, fontSize: 14, lineHeight: 21, marginTop: 8, marginBottom: 27 }}>
        We&apos;ll send recovery instructions to the email on your MedKnot account.
      </Text>
      {error ? <InlineAlert>{error}</InlineAlert> : null}
      {notice ? <InlineAlert tone="success">{notice}</InlineAlert> : null}
      <Controller control={control} name="email" render={({ field }) => (
        <TextField label="Email address" placeholder="you@example.com" icon="mail" keyboardType="email-address" autoCapitalize="none" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.email?.message} />
      )} />
      <DevelopmentNotice>For your security, this screen never confirms whether an email belongs to an account.</DevelopmentNotice>
      <PrimaryButton label="Send recovery link" loading={isSubmitting} onPress={() => submit()} style={{ marginTop: 14 }} />
    </ScreenShell>
  );
}
