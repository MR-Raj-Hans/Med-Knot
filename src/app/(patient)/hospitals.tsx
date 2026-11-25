import { Feather } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, Text, TextInput, View } from 'react-native';
import { DevelopmentNotice, Panel, PrimaryButton, ScreenShell, SectionHeading } from '@/components/ui';
import { searchVerifiedHospitals } from '@/services/careService';
import { isBackendConfigured } from '@/services/apiClient';
import { useSessionStore } from '@/store/sessionStore';
import { colors } from '@/theme/tokens';

export default function HospitalsScreen() {
  const session = useSessionStore((state) => state.session);
  const [city, setCity] = useState('');
  const [submittedCity, setSubmittedCity] = useState('');
  const [validationError, setValidationError] = useState('');
  const hospitalsQuery = useQuery({
    queryKey: ['directory', 'hospitals', submittedCity],
    queryFn: () => searchVerifiedHospitals(submittedCity),
    enabled: isBackendConfigured && !!session && submittedCity.length >= 2,
  });

  function submitSearch() {
    const value = city.trim();
    if (value.length < 2) {
      setValidationError('Enter at least two letters for a city or area.');
      return;
    }
    setValidationError('');
    setSubmittedCity(value);
  }

  const hospitals = hospitalsQuery.data ?? [];
  return (
    <ScreenShell>
      <Text style={{ color: colors.teal, fontSize: 10, fontWeight: '700', letterSpacing: 1.3, marginTop: 8 }}>VERIFIED CARE DIRECTORY</Text>
      <Text style={{ color: colors.ink, fontSize: 29, fontWeight: '700', letterSpacing: -0.8, marginTop: 7, marginBottom: 8 }}>Nearby hospitals</Text>
      <Text style={{ color: colors.inkSoft, fontSize: 13, lineHeight: 20, marginBottom: 17 }}>Search approved MedKnot hospital listings by city or area.</Text>
      <DevelopmentNotice>Distance sorting and device location are not available in this build. Results are verified directory listings for the city you enter.</DevelopmentNotice>

      <Panel style={{ padding: 14, marginVertical: 15 }}>
        <Text style={{ color: colors.ink, fontSize: 12, fontWeight: '700', marginBottom: 7 }}>City or area</Text>
        <TextInput value={city} onChangeText={(value) => { setCity(value); setValidationError(''); }} onSubmitEditing={submitSearch} returnKeyType="search" maxLength={100} placeholder="For example, Pune" placeholderTextColor={colors.muted} accessibilityLabel="Search hospitals by city or area" style={inputStyle} />
        {validationError ? <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 12, marginTop: 7 }}>{validationError}</Text> : null}
        <PrimaryButton label={hospitalsQuery.isFetching ? 'Searching…' : 'Search hospitals'} icon="search" disabled={!isBackendConfigured || hospitalsQuery.isFetching} loading={hospitalsQuery.isFetching} onPress={submitSearch} style={{ marginTop: 12 }} />
      </Panel>

      <SectionHeading title={submittedCity ? `Hospitals in ${submittedCity}` : 'Search results'} />
      {!isBackendConfigured ? <DevelopmentNotice>The verified hospital directory API is not connected. No sample hospitals are shown.</DevelopmentNotice> : null}
      {hospitalsQuery.isLoading ? <Panel style={{ alignItems: 'center', padding: 18 }}><ActivityIndicator color={colors.teal} /><Text style={{ color: colors.muted, fontSize: 12, marginTop: 8 }}>Searching approved listings…</Text></Panel> : null}
      {hospitalsQuery.isError ? <Panel><Text style={{ color: colors.ink, fontWeight: '700' }}>Hospitals could not be loaded.</Text><Text accessibilityRole="link" onPress={() => void hospitalsQuery.refetch()} style={{ color: colors.teal, fontSize: 12, fontWeight: '700', marginTop: 8 }}>Try again</Text></Panel> : null}
      {hospitalsQuery.isSuccess && hospitals.length === 0 ? <Panel style={{ alignItems: 'center', paddingVertical: 22 }}><Feather name="map" size={24} color={colors.teal} /><Text style={{ color: colors.ink, fontSize: 14, fontWeight: '700', marginTop: 10 }}>No approved listings found</Text><Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 5 }}>Try another city or area. MedKnot does not add unverified hospitals.</Text></Panel> : null}
      <View style={{ gap: 10 }}>
        {hospitals.map((hospital) => {
          const address = [hospital.addressLine1, hospital.city, hospital.region, hospital.postalCode, hospital.country].filter(Boolean).join(', ');
          return (
            <Panel key={hospital.id} style={{ padding: 14 }}>
              <View style={{ flexDirection: 'row', gap: 11, alignItems: 'flex-start' }}>
                <View style={{ width: 38, height: 38, borderRadius: 13, backgroundColor: colors.tealPale, alignItems: 'center', justifyContent: 'center' }}><Feather name="plus-square" size={17} color={colors.teal} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '700' }}>{hospital.name}</Text>
                  <Text style={{ color: colors.teal, fontSize: 10, fontWeight: '700', marginTop: 4 }}>VERIFIED LISTING</Text>
                  {address ? <Text style={{ color: colors.inkSoft, fontSize: 11, lineHeight: 17, marginTop: 7 }}>{address}</Text> : null}
                  {hospital.phone ? <Text selectable style={{ color: colors.blue, fontSize: 11, fontWeight: '700', marginTop: 7 }}>{hospital.phone}</Text> : null}
                  {hospital.departments.length ? <Text style={{ color: colors.muted, fontSize: 10, lineHeight: 16, marginTop: 7 }}>Departments: {hospital.departments.map((department) => department.name).join(' · ')}</Text> : null}
                </View>
              </View>
            </Panel>
          );
        })}
      </View>
      <Text style={{ color: colors.muted, fontSize: 10, lineHeight: 16, marginTop: 15 }}>A verified directory listing does not confirm opening hours, emergency capability, bed availability or current services. Contact the hospital to confirm.</Text>
    </ScreenShell>
  );
}

const inputStyle = { color: colors.ink, fontSize: 13, lineHeight: 19, backgroundColor: colors.canvas, borderColor: colors.line, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 } as const;
