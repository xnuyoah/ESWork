/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Shared i18n utility functions used by both main process and renderer.
 */

import i18nConfig from '@/common/config/i18n-config.json';
import { APP_NAME } from '@/common/config/constants';

export const SUPPORTED_LANGUAGES = i18nConfig.supportedLanguages;
export const DEFAULT_LANGUAGE = i18nConfig.fallbackLanguage;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/**
 * Normalize a language code to a supported BCP 47 tag.
 * e.g. 'zh' → 'zh-CN', 'ja_JP' → 'ja-JP'
 */
export function normalizeLanguageCode(language: string): SupportedLanguage {
  const normalized = language.replace(/_/g, '-');

  if (SUPPORTED_LANGUAGES.includes(normalized as SupportedLanguage)) {
    return normalized as SupportedLanguage;
  }

  const lower = normalized.toLowerCase();
  // Traditional-script regions and explicit Hant tags must not degrade to
  // Simplified Chinese: zh-HK / zh-MO / zh-Hant-* readers expect zh-TW.
  if (lower.startsWith('zh')) {
    return /\bhant\b|-hk\b|-mo\b/.test(lower) ? 'zh-TW' : 'zh-CN';
  }

  const langOnly = lower.split('-')[0];
  switch (langOnly) {
    case 'ja':
      return 'ja-JP';
    case 'ko':
      return 'ko-KR';
    case 'tr':
      return 'tr-TR';
    case 'ru':
      return 'ru-RU';
    case 'uk':
      return 'uk-UA';
    case 'pt':
      return 'pt-BR';
    case 'de':
      return 'de-DE';
    case 'es':
      return 'es-ES';
    case 'fr':
      return 'fr-FR';
    case 'fa':
      return 'fa-IR';
    default:
      return DEFAULT_LANGUAGE;
  }
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Deep-merge `target` into `fallback`, so that any key missing in `target`
 * falls back to the value in `fallback`.
 */
export function mergeWithFallback(
  fallback: Record<string, unknown>,
  target: Record<string, unknown>
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...fallback };

  for (const [key, value] of Object.entries(target)) {
    const fallbackValue = merged[key];
    if (isPlainObject(fallbackValue) && isPlainObject(value)) {
      merged[key] = mergeWithFallback(fallbackValue, value);
    } else {
      merged[key] = value;
    }
  }

  return merged;
}

export type LocaleData = Record<string, Record<string, unknown>>;

const UPSTREAM_APP_NAME_PATTERN = /AionUi|AionUI/g;

function brandTranslationValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.replace(UPSTREAM_APP_NAME_PATTERN, APP_NAME);
  }
  if (Array.isArray(value)) {
    return value.map(brandTranslationValue);
  }
  if (isPlainObject(value)) {
    return brandTranslationRecord(value);
  }
  return value;
}

function brandTranslationRecord(data: Record<string, unknown>): Record<string, unknown> {
  const branded: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    branded[key] = brandTranslationValue(value);
  }
  return branded;
}

/**
 * Replace the upstream display name in translation values without modifying
 * locale source files or compatibility-sensitive identifiers.
 */
export function applyAppBranding(localeData: LocaleData): LocaleData {
  const branded: LocaleData = {};
  for (const [locale, data] of Object.entries(localeData)) {
    branded[locale] = brandTranslationRecord(data);
  }
  return branded;
}

/**
 * Ensure a resource bundle is loaded, then switch i18next to the given language.
 * Deduplicates the "load-if-missing + changeLanguage" pattern.
 */
export async function ensureAndSwitch(
  i18n: {
    hasResourceBundle: (lng: string, ns: string) => boolean;
    addResourceBundle: (...args: unknown[]) => void;
    changeLanguage: (lng: string) => Promise<unknown>;
  },
  lang: string,
  getTranslation: (locale: string) => Record<string, unknown> | Promise<Record<string, unknown>>
): Promise<void> {
  const normalizedLang = normalizeLanguageCode(lang);
  if (!i18n.hasResourceBundle(normalizedLang, 'translation')) {
    const translation = await getTranslation(normalizedLang);
    i18n.addResourceBundle(normalizedLang, 'translation', translation, true, true);
  }
  await i18n.changeLanguage(normalizedLang);
}
