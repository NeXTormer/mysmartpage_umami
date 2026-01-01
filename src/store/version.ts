import { create } from 'zustand';
import { CURRENT_VERSION } from '@/lib/constants';


const initialState = {
  current: CURRENT_VERSION,
  latest: null,
  hasUpdate: false,
  checked: false,
  releaseUrl: null,
};

const store = create(() => ({ ...initialState }));

export async function checkVersion() {
  return null;
}

export const useVersion = store;
