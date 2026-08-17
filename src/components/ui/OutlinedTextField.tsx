/**
 * OutlinedTextField — RN equivalent of Material 3 OutlinedTextField.
 * Label floats above input, leading icon supported, focus state changes border color.
 */
import React, { useState } from 'react';
import {
  View, TextInput, ViewStyle, TextStyle,
  KeyboardTypeOptions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Palette } from '@/theme';
import { Layout } from '@/theme';
import { Txt } from './index';

export interface OutlinedTextFieldProps {
  value: string;
  onChangeText: (text: string) => void;
  label?: string;
  placeholder?: string;
  leadingIcon?: keyof typeof Ionicons.glyphMap;
  leadingIconColor?: string;
  trailingIcon?: React.ReactNode;
  keyboardType?: KeyboardTypeOptions;
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
  value, onChangeText, label, placeholder, leadingIcon, leadingIconColor,
  trailingIcon, keyboardType = 'default', secureTextEntry = false, multiline = false,
  numberOfLines = 1, maxLength, editable = true, testID,
  focusedBorderColor = Colors.borderFocus, unfocusedBorderColor = Colors.borderMuted,
  focusedTextColor = Colors.textPrimary, unfocusedTextColor = Colors.textPrimary,
  containerColor = Colors.surfaceMuted, borderRadius = Layout.borderRadiusButton, height, style, inputStyle,
}: OutlinedTextFieldProps) {
  const [focused, setFocused] = useState(false);
  const borderColor = focused ? focusedBorderColor : unfocusedBorderColor;
  const textColor = focused ? focusedTextColor : unfocusedTextColor;
  return (
    <View style={[{
      borderWidth: focused ? 1.5 : 1, borderColor, borderRadius,
      backgroundColor: containerColor, paddingHorizontal: 12,
      paddingVertical: 8, minHeight: height ?? (multiline ? 96 : 56),
      flexDirection: 'row', alignItems: 'center', gap: 8,
    }, style]}>
      {leadingIcon && (
        <Ionicons name={leadingIcon} size={18} color={leadingIconColor ?? (focused ? Colors.primary : Colors.textMuted)} />
      )}
      <View style={{ flex: 1 }}>
        {label && (
          <Txt variant="caption" color={focused ? Colors.primary : Colors.textMuted} weight="600" style={{ marginBottom: 2, letterSpacing: 0.4 }}>
            {label}
          </Txt>
        )}
        <TextInput
          testID={testID}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Palette.TextMuted}
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry}
          multiline={multiline}
          numberOfLines={numberOfLines}
          maxLength={maxLength}
          editable={editable}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[{
            color: textColor, fontSize: 14, padding: 0,
            minHeight: 22, textAlignVertical: 'top',
          }, inputStyle]}
        />
      </View>
      {trailingIcon}
    </View>
  );
}
