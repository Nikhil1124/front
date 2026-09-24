import { Keyboard } from 'react-native';

/**
 * Wraps a hardware-Back handler so the press that closes the keyboard only closes the keyboard.
 *
 * Android hands that same press to `BackHandler` as well. Every screen whose Back closes a form
 * or leaves the screen therefore threw away what was being typed: a resident who pressed Back
 * to see past the keyboard after entering their Aadhaar number lost the whole KYC form, photos
 * included. A second Back, once the keyboard is gone, reaches `onBack` as before.
 *
 * `keyboardDidHide` can land either side of the Back event, so a press within a moment of the
 * keyboard going away is treated as the one that closed it.
 */
let keyboardHiddenAt = 0;
Keyboard.addListener('keyboardDidHide', () => {
  keyboardHiddenAt = Date.now();
});

export function keyboardAwareBack(onBack: () => boolean): () => boolean {
  return () => {
    if (Keyboard.isVisible() || Date.now() - keyboardHiddenAt < 400) {
      Keyboard.dismiss();
      return true;
    }
    return onBack();
  };
}
