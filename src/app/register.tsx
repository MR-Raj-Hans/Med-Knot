import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Pressable, Text, View } from 'react-native';
import { z } from 'zod';
import { AuthTopBar, DevelopmentNotice, InlineAlert, PrimaryButton, ScreenShell, TextField } from '@/components/ui';
import { authService } from '@/services/authService';
import { useSessionStore } from '@/store/sessionStore';
import { colors } from '@/theme/tokens';

const registrationSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter your full name.'),
  email: z.string().trim().email('Enter a valid email address.'),
  phone: z.string().trim().min(8, 'Enter a valid mobile number.'),
  password: z.string().min(8, 'Use at least 8 characters.'),
  acceptedTerms: z.boolean().refine(Boolean, 'Please accept the Terms and Privacy Policy.'),
});
type RegistrationValues = z.infer<typeof registrationSchema>;

export default function RegisterScreen() {
  const setPendingVerification = useSessionStore((state) => state.setPendingVerification);
  const [requestError, setRequestError] = useState('');
  const { control, handleSubmit, formState: { errors, isSubmitting }, setValue } = useForm<RegistrationValues>({
    resolver: zodResolver(registrationSchema),
    defaultValues: { fullName: '', email: '', phone: '', password: '', acceptedTerms: false },
  });
  const acceptedTerms = useWatch({ control, name: 'acceptedTerms' });

  const onSubmit = handleSubmit(async (values) => {
    setRequestError('');
    try {
      const verification = await authService.requestVerification(values);
      setPendingVerification({ challengeId: verification.challengeId, email: values.email, patientName: values.fullName, mode: verification.mode, demoCode: verification.demoCode });
      router.push('/otp');
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : 'We could not create your account right now. Please try again.');
    }
  });

  return (
    <ScreenShell>
      <AuthTopBar onBack={() => router.back()} rightLabel="01 / 02" />
      <View style={{ marginBottom: 23 }}>
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 19 }}>
          <View style={{ width: 30, height: 4, borderRadius: 5, backgroundColor: colors.teal }} />
          <View style={{ width: 30, height: 4, borderRadius: 5, backgroundColor: '#DDE5E2' }} />
        </View>
        <Text style={{ color: colors.teal, fontSize: 11, fontWeight: '700', letterSpacing: 1.4 }}>LET&apos;S GET STARTED</Text>
        <Text style={{ color: colors.ink, fontSize: 31, lineHeight: 37, fontWeight: '700', letterSpacing: -1, marginTop: 8 }}>Create your account</Text>
        <Text style={{ color: colors.inkSoft, fontSize: 14, lineHeight: 21, marginTop: 8 }}>A few details help us make your care feel personal.</Text>
      </View>

      {requestError ? <InlineAlert>{requestError}</InlineAlert> : null}
      <Controller control={control} name="fullName" render={({ field }) => (
        <TextField label="Full name" placeholder="e.g. Riya Sharma" icon="user" autoCapitalize="words" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.fullName?.message} />
      )} />
      <Controller control={control} name="email" render={({ field }) => (
        <TextField label="Email address" placeholder="you@example.com" icon="mail" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.email?.message} />
      )} />
      <Controller control={control} name="phone" render={({ field }) => (
        <TextField label="Mobile number" placeholder="+91 98765 43210" icon="phone" keyboardType="phone-pad" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.phone?.message} />
      )} />
      <Controller control={control} name="password" render={({ field }) => (
        <TextField label="Create a password" placeholder="At least 8 characters" icon="lock" secureTextEntry value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.password?.message} />
      )} />

      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: acceptedTerms }} onPress={() => setValue('acceptedTerms', !acceptedTerms, { shouldValidate: true })} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 2, marginBottom: 10 }}>
        <View style={{ width: 20, height: 20, marginTop: 1, borderRadius: 6, borderWidth: 1, borderColor: acceptedTerms ? colors.teal : colors.line, backgroundColor: acceptedTerms ? colors.teal : '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
          {acceptedTerms ? <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>✓</Text> : null}
        </View>
        <Text style={{ flex: 1, color: colors.inkSoft, fontSize: 12, lineHeight: 19 }}>
          I agree to the <Text style={{ color: colors.blue, fontWeight: '700' }}>Terms of Service</Text> and <Text style={{ color: colors.blue, fontWeight: '700' }}>Privacy Policy</Text>.
        </Text>
      </Pressable>
      {errors.acceptedTerms?.message ? <Text style={{ color: colors.danger, fontSize: 12, marginBottom: 10 }}>{errors.acceptedTerms.message}</Text> : null}
      <DevelopmentNotice>Verification only counts after the shared server confirms your code.</DevelopmentNotice>
      <PrimaryButton label="Continue to verification" loading={isSubmitting} onPress={() => onSubmit()} style={{ marginTop: 12 }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 18 }}>
        <Text style={{ color: colors.muted, fontSize: 13 }}>Already registered?</Text>
        <Text accessibilityRole="link" onPress={() => router.push('/sign-in')} style={{ color: colors.blue, fontSize: 13, fontWeight: '700' }}>Sign in</Text>
      </View>
    </ScreenShell>
  );
}
