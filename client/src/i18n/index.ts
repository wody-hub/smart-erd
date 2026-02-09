/**
 * i18next 다국어 시스템 초기화.
 *
 * LanguageDetector(localStorage → navigator 순서)와 initReactI18next 플러그인을 등록한다.
 * 번역 리소스는 JSON 파일에서 정적으로 임포트하여 번들에 포함시킨다.
 *
 * @module i18n
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { STORAGE_KEYS } from '@/constants/storage';
import en from './locales/en/translation.json';
import ko from './locales/ko/translation.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ko: { translation: ko },
    },
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: STORAGE_KEYS.LANGUAGE,
      caches: ['localStorage'],
    },
  });

export default i18n;
