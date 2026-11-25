import { zodResolver } from '@hookform/resolvers/zod';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert, Image, Pressable, Text, View } from 'react-native';
import { z } from 'zod';
import { AuthTopBar, ChoiceChip, DevelopmentNotice, PrimaryButton, ScreenShell, TextField } from '@/components/ui';
import { useSessionStore } from '@/store/sessionStore';
import { colors } from '@/theme/tokens';
import type { PatientProfile } from '@/types/health';

const profileSchema = z.object({
  dateOfBirth: z.string().trim()
    .regex(/^\d{2}\/\d{2}\/\d{4}$/, 'Use DD/MM/YYYY.')
    .refine((value) => {
      const [day, month, year] = value.split('/').map(Number);
      const date = new Date(year, month - 1, day);
      return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
    }, 'Enter a valid date.'),
  gender: z.enum(['woman', 'man', 'nonbinary', 'prefer-not-to-say'], { error: 'Choose an option to continue.' }),
  address: z.string().trim().max(120, 'Keep your address under 120 characters.'),
  emergencyContactName: z.string().trim().max(60, 'Keep the name under 60 characters.'),
  emergencyContactPhone: z.string().trim().max(24, 'Keep the phone number under 24 characters.'),
}).superRefine((value, context) => {
  if (Boolean(value.emergencyContactName) !== Boolean(value.emergencyContactPhone)) {
    context.addIssue({ code: 'custom', path: ['emergencyContactPhone'], message: 'Add both emergency contact fields or leave them blank.' });
  } else if (value.emergencyContactPhone && value.emergencyContactPhone.replace(/\D/g, '').length < 8) {
    context.addIssue({ code: 'custom', path: ['emergencyContactPhone'], message: 'Enter a valid emergency contact number.' });
  }
});
type ProfileValues = z.infer<typeof profileSchema>;

const genderOptions = [
  { value: 'woman', label: 'Woman' },
  { value: 'man', label: 'Man' },
  { value: 'nonbinary', label: 'Non-binary' },
  { value: 'prefer-not-to-say', label: 'Prefer not to say' },
] as const;

export default function ProfileSetupScreen() {
  const setProfile = useSessionStore((state) => state.setProfile);
  const session = useSessionStore((state) => state.session);
  const authReady = useSessionStore((state) => state.authReady);
  const [photoUri, setPhotoUri] = useState<string>();
  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { dateOfBirth: '', address: '', emergencyContactName: '', emergencyContactPhone: '' },
  });

  const choosePhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo access is off', 'You can continue without a profile photo or enable photo access in Settings.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (!result.canceled) setPhotoUri(result.assets[0]?.uri);
  };

  const finish = handleSubmit((values) => {
    const profile: PatientProfile = {
      dateOfBirth: values.dateOfBirth,
      gender: values.gender,
      address: values.address,
      emergencyContactName: values.emergencyContactName,
      emergencyContactPhone: values.emergencyContactPhone,
      photoUri,
    };
    setProfile(profile);
    router.replace('/(patient)/home');
  });

  if (!authReady) return <View style={{ flex: 1, backgroundColor: colors.canvas }} />;

  return (
    <ScreenShell>
      <AuthTopBar rightLabel="OPTIONAL" />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15, marginBottom: 22 }}>
        <Pressable onPress={choosePhoto} accessibilityRole="button" accessibilityLabel="Add profile photo" style={{ width: 62, height: 62, borderRadius: 22, backgroundColor: colors.tealPale, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {photoUri ? <Image source={{ uri: photoUri }} style={{ width: 62, height: 62 }} /> : <Text style={{ color: colors.teal, fontSize: 26, fontWeight: '400' }}>+</Text>}
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.teal, fontSize: 10, fontWeight: '700', letterSpacing: 1.3 }}>A LITTLE MORE ABOUT YOU</Text>
          <Text style={{ color: colors.ink, fontSize: 12, marginTop: 5 }}>Add a photo · optional</Text>
        </View>
      </View>
      <Text style={{ color: colors.ink, fontSize: 31, lineHeight: 38, fontWeight: '700', letterSpacing: -1 }}>Make care feel personal.</Text>
      <Text style={{ color: colors.inkSoft, fontSize: 14, lineHeight: 21, marginTop: 8, marginBottom: 20 }}>
        Share what feels comfortable. You can update these details later.
      </Text>
      <Controller control={control} name="dateOfBirth" render={({ field }) => (
        <TextField label="Date of birth" placeholder="DD / MM / YYYY" icon="calendar" keyboardType="numbers-and-punctuation" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.dateOfBirth?.message} hint="Used to personalize age-related care information." />
      )} />
      <Controller control={control} name="gender" render={({ field }) => (
        <View style={{ marginBottom: 17 }}>
          <Text style={{ color: colors.ink, fontSize: 13, fontWeight: '700', marginLeft: 2, marginBottom: 9 }}>Gender</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {genderOptions.map((option) => <ChoiceChip key={option.value} label={option.label} selected={field.value === option.value} onPress={() => field.onChange(option.value)} />)}
          </View>
          {errors.gender?.message ? <Text style={{ color: colors.danger, fontSize: 12, marginTop: 6 }}>{errors.gender.message}</Text> : null}
        </View>
      )} />
      <Controller control={control} name="address" render={({ field }) => (
        <TextField label="City or address" placeholder="City, state" icon="map-pin" autoCapitalize="words" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.address?.message} />
      )} />
      <View style={{ marginTop: 4, marginBottom: 12 }}>
        <Text style={{ color: colors.ink, fontSize: 13, fontWeight: '700', marginBottom: 11 }}>Emergency contact <Text style={{ color: colors.muted, fontWeight: '400' }}>· optional</Text></Text>
        <Controller control={control} name="emergencyContactName" render={({ field }) => (
          <TextField label="Contact name" placeholder="Full name" icon="user" autoCapitalize="words" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.emergencyContactName?.message} />
        )} />
        <Controller control={control} name="emergencyContactPhone" render={({ field }) => (
          <TextField label="Contact number" placeholder="Mobile number" icon="phone" keyboardType="phone-pad" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.emergencyContactPhone?.message} />
        )} />
      </View>
      <DevelopmentNotice>These profile details are saved for this session only. They are not synced to a hospital record yet.</DevelopmentNotice>
      <PrimaryButton label="Save and continue" loading={isSubmitting} onPress={() => finish()} style={{ marginTop: 10 }} />
      <Text onPress={() => router.replace('/(patient)/home')} accessibilityRole="link" style={{ textAlign: 'center', color: colors.blue, fontSize: 13, fontWeight: '700', paddingVertical: 18 }}>I&apos;ll do this later</Text>
      <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 17, textAlign: 'center', marginBottom: 8 }}>
        {session?.mode === 'development' ? 'Development preview · your account is not connected to a hospital record.' : 'Patient profile sync will be available when the backend profile endpoint is connected.'}
      </Text>
    </ScreenShell>
  );
}
