import * as SecureStore from 'expo-secure-store';

import {
  createShadowParityEvidenceStore,
} from './jahiz-shadow-parity-evidence-store';

export function createSecureShadowParityEvidenceStore() {
  return createShadowParityEvidenceStore({
    getItemAsync:
      SecureStore.getItemAsync,
    setItemAsync:
      SecureStore.setItemAsync,
  });
}
