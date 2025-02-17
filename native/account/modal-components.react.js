// @flow

import invariant from 'invariant';
import * as React from 'react';
import { TextInput as BaseTextInput, View, StyleSheet } from 'react-native';
import { createSelector } from 'reselect';

import type { AppState } from '../redux/redux-setup';

class TextInput extends React.PureComponent<*> {
  innerTextInput: ?React.ElementRef<typeof BaseTextInput>;

  render() {
    const style = [styles.textInput, this.props.style];
    return (
      <View style={styles.textInputWrapperView}>
        <BaseTextInput
          placeholderTextColor="#888888"
          {...this.props}
          style={style}
          ref={this.innerTextInputRef}
        />
      </View>
    );
  }

  innerTextInputRef = (
    innerTextInput: ?React.ElementRef<typeof BaseTextInput>,
  ) => {
    this.innerTextInput = innerTextInput;
  };

  focus() {
    invariant(this.innerTextInput, 'ref should exist');
    this.innerTextInput.focus();
  }
}

const styles = StyleSheet.create({
  textInput: {
    borderBottomColor: 'transparent',
    color: 'black',
    fontSize: 20,
    height: 40,
    margin: 0,
    padding: 0,
  },
  textInputWrapperView: {
    borderBottomColor: '#BBBBBB',
    borderBottomWidth: 1,
  },
});

const usernamePlaceholderSelector: (state: AppState) => string = createSelector(
  (state: AppState) => state.dimensions.width,
  (windowWidth: number): string =>
    windowWidth < 360 ? 'Username or email' : 'Username or email address',
);

export { TextInput, usernamePlaceholderSelector };
