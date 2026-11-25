import { fireEvent, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import RegisterScreen from '@/app/register';
import WelcomeScreen from '@/app/welcome';

describe('patient onboarding navigation', () => {
  it('opens registration from welcome and validates required fields', async () => {
    await renderRouter(
      {
        index: WelcomeScreen,
        register: RegisterScreen,
      },
      { initialUrl: '/' },
    );

    await fireEvent.press(screen.getByText('Create your account'));
    expect(await screen.findByText('A few details help us make your care feel personal.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Continue to verification' }));

    expect(await screen.findByText('Enter your full name.')).toBeTruthy();
    expect(screen.getByText('Enter a valid email address.')).toBeTruthy();
    expect(screen.getByText('Enter a valid mobile number.')).toBeTruthy();
    expect(screen.getByText('Use at least 8 characters.')).toBeTruthy();
  });
});
