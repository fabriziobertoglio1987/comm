// @flow

import * as React from 'react';

import css from '../../style.css';
import Modal from '../modal.react';

type Props = {|
  onClose: () => void,
|};

export default function PasswordResetEmailModal(props: Props): React.Node {
  return (
    <Modal name="Password reset email sent" onClose={props.onClose}>
      <div className={css['modal-body']}>
        <p>
          {"We've sent you an email with instructions on how to reset "}
          {'your password. Note that the email will expire in a day.'}
        </p>
      </div>
    </Modal>
  );
}
