import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  LANGUAGE_CODES,
  type LanguageCode,
} from "@paperclipai/shared";

import zhCN from "./locales/zh-CN.json";
import en from "./locales/en.json";

function getInitialLanguage(): LanguageCode {
  if (typeof window === "undefined") {
    return DEFAULT_LANGUAGE;
  }

  const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (stored && Object.values(LANGUAGE_CODES).includes(stored as LanguageCode)) {
    return stored as LanguageCode;
  }

  const browserLang = navigator.language;
  if (browserLang.startsWith("zh")) {
    return LANGUAGE_CODES.ZH_CN;
  }
  // Handle en-* browser languages (en-US, en-GB, etc.)
  if (browserLang.startsWith("en")) {
    return LANGUAGE_CODES.EN;
  }

  return DEFAULT_LANGUAGE;
}

i18n.use(initReactI18next).init({
  resources: {
    [LANGUAGE_CODES.ZH_CN]: {
      translation: zhCN,
    },
    [LANGUAGE_CODES.EN]: {
      translation: en,
    },
  },
  lng: getInitialLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: {
    escapeValue: false,
  },
});

export function changeLanguage(lang: LanguageCode) {
  localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  i18n.changeLanguage(lang);
}

export function getCurrentLanguage(): LanguageCode {
  return i18n.language as LanguageCode;
}

export { i18n };
export default i18n;