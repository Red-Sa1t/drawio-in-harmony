// System locale for the Electron main process ("follow system language").
//
// i18n.System.getSystemLocale() reads the current system setting on every
// call (e.g. "zh-Hans-CN", "en-Latn-US"), so a language changed in Settings is
// seen while the app keeps running. The main process polls it through
// systemPreferences.callArkTSFunction('HarmonyLocale.GetSystemLocale', ...)
// (installHarmonyLanguageFollow in harmony-runtime.js); no logging here because
// it is polled.

import { i18n } from '@kit.LocalizationKit';
import JsBindingUtils from '../utils/JsBindingUtils';

export class SystemLocaleBridge {
  static bind(): void {
    JsBindingUtils.bindFunction('HarmonyLocale.GetSystemLocale', (): string => {
      try {
        return i18n.System.getSystemLocale();
      } catch (e) {
        return '';
      }
    });
  }
}
