// @flow

import * as React from 'react';
import { View, Text, ScrollView, Platform } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useDispatch } from 'react-redux';

import type { Dispatch } from 'lib/types/redux-types';

import Button from '../components/button.react';
import { updateThemeInfoActionType } from '../redux/action-types';
import { useSelector } from '../redux/redux-utils';
import { type Colors, useColors, useStyles } from '../themes/colors';
import {
  type GlobalThemePreference,
  type GlobalThemeInfo,
  osCanTheme,
} from '../types/themes';

const CheckIcon = () => (
  <Icon
    name="md-checkmark"
    size={20}
    color="#008800"
    style={unboundStyles.icon}
  />
);

type OptionText = {|
  themePreference: GlobalThemePreference,
  text: string,
|};
const optionTexts: OptionText[] = [
  { themePreference: 'light', text: 'Light' },
  { themePreference: 'dark', text: 'Dark' },
];
if (osCanTheme) {
  optionTexts.push({
    themePreference: 'system',
    text: 'Follow system preferences',
  });
}

type Props = {
  +globalThemeInfo: GlobalThemeInfo,
  +styles: typeof unboundStyles,
  +colors: Colors,
  +dispatch: Dispatch,
  ...
};
class AppearancePreferences extends React.PureComponent<Props> {
  render() {
    const { panelIosHighlightUnderlay: underlay } = this.props.colors;

    const options = [];
    for (let i = 0; i < optionTexts.length; i++) {
      const { themePreference, text } = optionTexts[i];
      const icon =
        themePreference === this.props.globalThemeInfo.preference ? (
          <CheckIcon />
        ) : null;
      options.push(
        <Button
          onPress={() => this.onSelectThemePreference(themePreference)}
          style={this.props.styles.row}
          iosFormat="highlight"
          iosHighlightUnderlayColor={underlay}
          key={`button_${themePreference}`}
        >
          <Text style={this.props.styles.option}>{text}</Text>
          {icon}
        </Button>,
      );
      if (i + 1 < optionTexts.length) {
        options.push(
          <View style={this.props.styles.hr} key={`hr_${themePreference}`} />,
        );
      }
    }

    return (
      <ScrollView
        contentContainerStyle={this.props.styles.scrollViewContentContainer}
        style={this.props.styles.scrollView}
      >
        <Text style={this.props.styles.header}>APP THEME</Text>
        <View style={this.props.styles.section}>{options}</View>
      </ScrollView>
    );
  }

  onSelectThemePreference = (themePreference: GlobalThemePreference) => {
    if (themePreference === this.props.globalThemeInfo.preference) {
      return;
    }
    const theme =
      themePreference === 'system'
        ? this.props.globalThemeInfo.systemTheme
        : themePreference;
    this.props.dispatch({
      type: updateThemeInfoActionType,
      payload: {
        preference: themePreference,
        activeTheme: theme,
      },
    });
  };
}

const unboundStyles = {
  header: {
    color: 'panelBackgroundLabel',
    fontSize: 12,
    fontWeight: '400',
    paddingBottom: 3,
    paddingHorizontal: 24,
  },
  hr: {
    backgroundColor: 'panelForegroundBorder',
    height: 1,
    marginHorizontal: 15,
  },
  icon: {
    lineHeight: Platform.OS === 'ios' ? 18 : 20,
  },
  option: {
    color: 'panelForegroundLabel',
    fontSize: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  scrollView: {
    backgroundColor: 'panelBackground',
  },
  scrollViewContentContainer: {
    paddingTop: 24,
  },
  section: {
    backgroundColor: 'panelForeground',
    borderBottomWidth: 1,
    borderColor: 'panelForegroundBorder',
    borderTopWidth: 1,
    marginBottom: 24,
    paddingVertical: 2,
  },
};

export default React.memo<{ ... }>(
  function ConnectedAppearancePreferences(props: { ... }) {
    const globalThemeInfo = useSelector(state => state.globalThemeInfo);
    const styles = useStyles(unboundStyles);
    const colors = useColors();
    const dispatch = useDispatch();

    return (
      <AppearancePreferences
        {...props}
        globalThemeInfo={globalThemeInfo}
        styles={styles}
        colors={colors}
        dispatch={dispatch}
      />
    );
  },
);
