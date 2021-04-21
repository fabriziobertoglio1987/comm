// @flow

import * as React from 'react';

import css from '../../style.css';
import Modal from '../modal.react';

type Props = {|
  onClose: () => void,
|};

export default function VerifyEmailModal(props: Props): React.Node {
  return (
    <Modal name="Verify email" onClose={props.onClose}>
      <div className={css['modal-body']}>
        <p>
          We&apos;ve sent you an email to verify your email address. Just click
          on the link in the email to complete the verification process.
        </p>
        <p>
          Note that the email will expire in a day, but another email can be
          sent from &ldquo;Edit account&rdquo; in the user menu at any time.
        </p>
      </div>
    </Modal>
  );
}
