/**
 * OutlinedTextField — the app's one text input.
 *
 * ── The shape, and why ───────────────────────────────────────────────────────────────────────
 * A soft filled box with no border at rest, a brand border and ring on focus, and a red-tinted
 * fill when it's wrong. The name is now historical: this stopped being an outlined Material
 * field because thirteen outlined boxes on the add-resident screen read as a wall of boxes,
 * while thirteen filled ones read as a form. A border is drawn when it means something —
 * you're in this field — rather than permanently around everything.
 *
 * It pairs with `PickerField`, and the pairing is the point: a **filled box means you type
 * here**, a **row with a chevron means you choose here**. Someone can see, without reading a
 * word, which fields will make them use the keyboard. That is the "use a picker unless typing
 * is genuinely necessary" rule made structural instead of a convention to remember.
 *
 * ── Errors live on the field ─────────────────────────────────────────────────────────────────
 * `error` is new, and it is the reason this rewrite exists. There were 34 places calling
 * `Alert.alert('Validation', 'Title and message are required.')` — a blocking OS popup that
 * names the problem in prose, disappears when dismissed, and leaves the person to work out
 * which of thirteen fields it meant. The field can say it itself, next to itself, and keep
 * saying it until it's fixed.
 *
 * The border width stays 1.5 in every state (transparent when at rest) so focusing a field
 * never shifts the layout of the fields under it.
 */
import React, { useState } from 'react';
import {
  View, TextInput, type ViewStyle, type TextStyle,
  type KeyboardTypeOptions, type TextInputProps, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Palette, Radii } from '@/theme';
import { fontFamilyForWeight } from '@/theme/typography';
import { Txt } from './Txt';

export interface OutlinedTextFieldProps {
  value: string;
  onChangeText: (text: string) => void;
  label?: string;
  placeholder?: string;
  /** What's wrong, in words the person can act on — "Enter the monthly rent", not "Invalid".
   *  Present ⇒ the field renders its error state and this replaces `helper`. */
  error?: string;
  /** The quiet line under the field, for a format hint or a consequence — "Everyone at the
   *  property sees this". Hidden while `error` is showing. */
  helper?: string;
  /** Draws the asterisk and tells a screen reader. Does not itself validate anything — the
   *  screen still decides what "missing" means and passes `error`. */
  required?: boolean;
  leadingIcon?: keyof typeof Ionicons.glyphMap;
  leadingIconColor?: string;
  trailingIcon?: React.ReactNode;
  keyboardType?: KeyboardTypeOptions;
  /** Native password-manager and autofill metadata. Passed through unchanged so each screen
   * can state what the field actually collects instead of guessing from a label. */
  textContentType?: TextInputProps['textContentType'];
  autoComplete?: TextInputProps['autoComplete'];
  secureTextEntry?: boolean;
  multiline?: boolean;
  numberOfLines?: number;
  maxLength?: number;
  editable?: boolean;
  testID?: string;
  focusedBorderColor?: string;
  unfocusedBorderColor?: string;
  focusedTextColor?: string;
  unfocusedTextColor?: string;
  containerColor?: string;
  borderRadius?: number;
  height?: number;
  style?: ViewStyle;
  inputStyle?: TextStyle;
  onContentSizeChange?: (e: any) => void;
}

export function OutlinedTextField({
  value, onChangeText, label, placeholder, error, helper, required = false,
  leadingIcon, leadingIconColor,
  trailingIcon, keyboardType = 'default', secureTextEntry = false, multiline = false,
  textContentType, autoComplete,
  numberOfLines = 1, maxLength, editable = true, testID,
  focusedBorderColor = Colors.borderFocus, unfocusedBorderColor,
  focusedTextColor = Colors.textPrimary, unfocusedTextColor = Colors.textPrimary,
  containerColor, borderRadius = Radii.control, height, style, inputStyle,
}: OutlinedTextFieldProps) {
  const [focused, setFocused] = useState(false);
  const invalid = !!error;

  // Rest is fill-only. `unfocusedBorderColor` is still honoured when a caller passes one, so
  // the handful of screens that deliberately draw an edge keep it.
  const borderColor = invalid
    ? Colors.danger
    : focused
      ? focusedBorderColor
      : unfocusedBorderColor ?? 'transparent';

  const fill = containerColor ?? (invalid ? Palette.TintRed : focused ? Colors.surface : Colors.surfaceMuted);
  const labelColor = invalid ? Colors.danger : focused ? Colors.primary : Colors.textMuted;

  return (
    <View style={style}>
      {label ? (
        <Txt variant="meta" weight="600" color={labelColor} style={{ marginBottom: 5 }}>
          {label}{required ? ' *' : ''}
        </Txt>
      ) : null}

      <View style={{
        borderWidth: 1.5,
        borderColor,
        borderRadius,
        backgroundColor: fill,
        paddingHorizontal: 12,
        paddingVertical: 8,
        minHeight: height ?? (multiline ? 88 : 46),
        flexDirection: 'row',
        alignItems: multiline ? 'flex-start' : 'center',
        gap: 8,
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: (focused && !invalid) ? 0.16 : 0,
        shadowRadius: 4,
      }}>
        {leadingIcon && (
          <Ionicons
            name={leadingIcon}
            size={18}
            color={leadingIconColor ?? (invalid ? Colors.danger : focused ? Colors.primary : Colors.textMuted)}
          />
        )}
        <TextInput
          testID={testID}
          // The label is a sibling <Txt>, so a screen reader would otherwise read it as loose
          // text and announce the field with nothing but its placeholder. Naming the input is
          // what ties the two together — "Phone number, required, edit box".
          accessibilityLabel={label ? `${label}${required ? ', required' : ''}` : undefined}
          // The error has to reach a screen reader too, or the red fill is the only signal
          // and it reaches nobody who can't see it.
          accessibilityHint={error ?? helper}
          maxFontSizeMultiplier={1.3}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.textMuted}
          keyboardType={keyboardType}
          textContentType={textContentType}
          autoComplete={autoComplete}
          importantForAutofill={autoComplete === 'off' ? 'no' : undefined}
          secureTextEntry={secureTextEntry}
          multiline={multiline}
          numberOfLines={numberOfLines}
          maxLength={maxLength}
          editable={editable}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[{
            flex: 1,
            color: focused ? focusedTextColor : unfocusedTextColor,
            fontSize: 14,
            lineHeight: 20,
            fontFamily: fontFamilyForWeight('400'),
            fontWeight: '400',
            padding: 0,
            minHeight: 22,
            textAlignVertical: multiline ? 'top' : 'center',
          }, inputStyle]}
        />
        {trailingIcon}
      </View>

      {error || helper ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 }}>
          {invalid ? <Ionicons name="alert-circle" size={13} color={Colors.danger} /> : null}
          <Txt variant="meta" color={invalid ? Colors.danger : Colors.textMuted} style={{ flex: 1 }}>
            {error ?? helper}
          </Txt>
        </View>
      ) : null}
    </View>
  );
}
