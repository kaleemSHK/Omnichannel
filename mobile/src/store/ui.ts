import { create } from 'zustand';

interface UiState {
  locale: 'ar' | 'en';
  isRTL: boolean;
  setLocale: (locale: 'ar' | 'en', isRTL: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  locale: 'en',
  isRTL: false,
  setLocale: (locale, isRTL) => set({ locale, isRTL }),
}));
