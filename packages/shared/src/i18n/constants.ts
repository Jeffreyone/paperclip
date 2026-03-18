export const LANGUAGE_CODES = {
  ZH_CN: "zh-CN",
  EN: "en",
} as const;

export type LanguageCode = (typeof LANGUAGE_CODES)[keyof typeof LANGUAGE_CODES];

export const SUPPORTED_LANGUAGES = [LANGUAGE_CODES.ZH_CN, LANGUAGE_CODES.EN] as const;
export const DEFAULT_LANGUAGE = LANGUAGE_CODES.EN;

export const LANGUAGE_NAMES: Record<LanguageCode, string> = {
  [LANGUAGE_CODES.ZH_CN]: "简体中文",
  [LANGUAGE_CODES.EN]: "English",
};

export const LANGUAGE_STORAGE_KEY = "paperclip-language";