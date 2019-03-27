// @flow

import { type Media, mediaPropType } from 'lib/types/media-types';
import type { ImageStyle } from '../types/styles';
import {
  type Navigate,
  MultimediaModalRouteName,
} from '../navigation/route-names';

import * as React from 'react';
import PropTypes from 'prop-types';
import { View, TouchableWithoutFeedback, StyleSheet } from 'react-native';

import Multimedia from '../media/multimedia.react';

type Props = {|
  media: Media,
  navigate: Navigate,
  style?: ImageStyle,
|};
class MultimediaMessageMultimedia extends React.PureComponent<Props> {

  static propTypes = {
    media: mediaPropType.isRequired,
    navigate: PropTypes.func.isRequired,
  };
  view: ?View;

  render() {
    const { media, style } = this.props;
    return (
      <TouchableWithoutFeedback onPress={this.onPress}>
        <View style={[styles.expand, style]} ref={this.viewRef}>
          <Multimedia media={media} style={styles.expand} />
        </View>
      </TouchableWithoutFeedback>
    );
  }

  viewRef = (view: ?View) => {
    this.view = view;
  }

  onPress = () => {
    const { view } = this;
    if (!view) {
      return;
    }
    view.measure((x, y, width, height, pageX, pageY) => {
      const coordinates = { x: pageX, y: pageY, width, height };
      const { media, navigate } = this.props;
      navigate({
        routeName: MultimediaModalRouteName,
        params: { media, initialCoordinates: coordinates },
      });
    });
  }

}

const styles = StyleSheet.create({
  expand: {
    flex: 1,
  },
});

export default MultimediaMessageMultimedia;
