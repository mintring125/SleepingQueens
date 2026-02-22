/**
 * haptic.js — Vibration feedback via Vibration API
 */

const HapticPatterns = {
  ring:    [50],             // Quick tap when bell area touched
  success: [50, 50, 100],    // Short-pause-long for correct
  fail:    [200, 50, 200],   // Long-pause-long for wrong
  deal:    [30],             // Light tap when card dealt
  collect: [30, 20, 30],     // Two quick taps for collecting
  eliminated: [400],         // Long buzz for elimination
};

function hapticFeedback(type) {
  if (!navigator.vibrate) return;
  const pattern = HapticPatterns[type] || [50];
  navigator.vibrate(pattern);
}
