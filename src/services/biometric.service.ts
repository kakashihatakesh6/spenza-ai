import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';
import { logger } from './logger';

export interface BiometricStatus {
  isHardwareAvailable: boolean;
  isEnrolled: boolean;
  supportedTypes: string[];
  primaryType: 'fingerprint' | 'face' | 'iris' | 'biometrics';
}

export const biometricService = {
  /**
   * Check if hardware and enrolled biometrics are available on the current device
   */
  async checkBiometricSupport(): Promise<BiometricStatus> {
    try {
      if (Platform.OS === 'web') {
        return {
          isHardwareAvailable: true,
          isEnrolled: true,
          supportedTypes: ['Fingerprint / Touch ID'],
          primaryType: 'fingerprint',
        };
      }

      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();

      const supportedTypes: string[] = [];
      let primaryType: 'fingerprint' | 'face' | 'iris' | 'biometrics' = 'fingerprint';

      types.forEach((type) => {
        if (type === LocalAuthentication.AuthenticationType.FINGERPRINT) {
          supportedTypes.push(Platform.OS === 'ios' ? 'Touch ID' : 'Fingerprint');
          primaryType = 'fingerprint';
        } else if (type === LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION) {
          supportedTypes.push(Platform.OS === 'ios' ? 'Face ID' : 'Facial Recognition');
          if (primaryType !== 'fingerprint') primaryType = 'face';
        } else if (type === LocalAuthentication.AuthenticationType.IRIS) {
          supportedTypes.push('Iris Recognition');
          if (primaryType !== 'fingerprint') primaryType = 'iris';
        }
      });

      if (supportedTypes.length === 0) {
        supportedTypes.push('Biometrics');
        primaryType = 'biometrics';
      }

      return {
        isHardwareAvailable: hasHardware,
        isEnrolled,
        supportedTypes,
        primaryType,
      };
    } catch (error) {
      logger.error('Error checking biometric support', error);
      return {
        isHardwareAvailable: false,
        isEnrolled: false,
        supportedTypes: [],
        primaryType: 'biometrics',
      };
    }
  },

  /**
   * Trigger native biometric prompt to authenticate the user
   */
  async authenticate(promptMessage: string = 'Scan your fingerprint to unlock Spendly'): Promise<{ success: boolean; error?: string }> {
    try {
      if (Platform.OS === 'web') {
        return { success: true };
      }

      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      if (!hasHardware) {
        return { success: false, error: 'Biometric hardware is not available on this device.' };
      }

      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!isEnrolled) {
        return { success: false, error: 'No biometrics enrolled. Please set up fingerprint in device settings.' };
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage,
        cancelLabel: 'Cancel',
        fallbackLabel: 'Use Passcode',
        disableDeviceFallback: false,
      });

      if (result.success) {
        logger.info('Biometric authentication succeeded');
        return { success: true };
      } else {
        logger.warn('Biometric authentication failed or cancelled', result.error);
        return {
          success: false,
          error: result.error === 'user_cancel' ? 'Authentication cancelled.' : 'Biometric verification failed. Please try again.',
        };
      }
    } catch (error: any) {
      logger.error('Biometric authentication exception', error);
      return { success: false, error: error?.message || 'Biometric authentication failed.' };
    }
  },
};
