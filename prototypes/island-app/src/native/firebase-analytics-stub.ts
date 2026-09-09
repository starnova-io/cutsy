/* Build-time stub for `firebase/analytics`.
 *
 * @capacitor-firebase/analytics' WEB implementation imports the Firebase JS SDK,
 * but Hearth Island logs analytics only through the native bridge (see
 * analytics.ts, which no-ops on web). We never ship or run the Firebase web SDK,
 * so we alias `firebase/analytics` to these no-ops and keep it out of the bundle.
 */
export const getAnalytics = () => ({});
export const logEvent = () => undefined;
export const setAnalyticsCollectionEnabled = () => undefined;
export const setConsent = () => undefined;
export const setUserId = () => undefined;
export const setUserProperties = () => undefined;
