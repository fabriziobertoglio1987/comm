// @flow

import { create } from '@lottiefiles/lottie-interactivity';
import * as React from 'react';

import css from './landing.css';
import ReadDocsButton from './read-docs-btn.react';
import StarBackground from './star-background.react';
import SubscriptionForm from './subscription-form.react';

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? React.useLayoutEffect : React.useEffect;

function Landing(): React.Node {
  React.useEffect(() => {
    import('@lottiefiles/lottie-player');
  }, []);

  const onEyeIllustrationLoad = React.useCallback(() => {
    create({
      mode: 'scroll',
      player: '#eye-illustration',
      actions: [
        {
          visibility: [0, 1],
          type: 'seek',
          frames: [0, 720],
        },
      ],
    });
  }, []);

  const onCloudIllustrationLoad = React.useCallback(() => {
    create({
      mode: 'scroll',
      player: '#cloud-illustration',
      actions: [
        {
          visibility: [0, 0.2],
          type: 'stop',
          frames: [0],
        },
        {
          visibility: [0.2, 1],
          type: 'seek',
          frames: [0, 300],
        },
      ],
    });
  }, []);

  const [eyeNode, setEyeNode] = React.useState(null);
  useIsomorphicLayoutEffect(() => {
    if (!eyeNode) {
      return;
    }
    eyeNode.addEventListener('load', onEyeIllustrationLoad);
    return () => eyeNode.removeEventListener('load', onEyeIllustrationLoad);
  }, [eyeNode, onEyeIllustrationLoad]);

  const [cloudNode, setCloudNode] = React.useState(null);
  useIsomorphicLayoutEffect(() => {
    if (!cloudNode) {
      return;
    }
    cloudNode.addEventListener('load', onCloudIllustrationLoad);
    return () => cloudNode.removeEventListener('load', onCloudIllustrationLoad);
  }, [cloudNode, onCloudIllustrationLoad]);

  return (
    <div>
      <StarBackground className={css.particles} />
      <div className={css.grid}>
        <h1 className={css.title}>Comm</h1>
        <div className={`${css.hero_image} ${css.starting_section}`}>
          <lottie-player
            id="eye-illustration"
            ref={setEyeNode}
            mode="normal"
            src="images/animated_eye.json"
            speed={1}
          />
        </div>
        <div className={`${css.hero_copy} ${css.section}`}>
          <h1>
            Reclaim your
            <span className={css.purple}> digital&nbsp;identity.</span>
          </h1>
          <p>
            The Internet is broken today. Private user data is owned by
            mega-corporations and farmed for their benefit.
          </p>
          <p>
            E2E encryption has the potential to change this equation. But
            it&apos;s constrained by a crucial limitation.
          </p>
        </div>

        <div className={`${css.server_image} ${css.starting_section}`}>
          <lottie-player
            id="cloud-illustration"
            ref={setCloudNode}
            mode="normal"
            src="images/animated_cloud.json"
            speed={1}
          />
        </div>
        <div className={`${css.server_copy} ${css.section}`}>
          <h2>Apps need servers.</h2>
          <p>
            Sophisticated applications rely on servers to do things that your
            devices simply can&apos;t.
          </p>
          <p>
            That&apos;s why E2E encryption only works for simple chat apps
            today. There&apos;s no way to build a robust server layer that has
            access to your data without leaking that data to corporations.
          </p>
        </div>

        <div className={css.keyserver_company}>
          <h1>
            Comm is the <span className={css.purple}>keyserver</span> company.
          </h1>
        </div>

        <div className={css.keyserver_copy}>
          <p>In the future, people have their own servers.</p>
          <p>
            Your keyserver is the home of your digital identity. It owns your
            private keys and your personal data. It&apos;s your password
            manager, your crypto bank, your digital surrogate, and your second
            brain.
          </p>
        </div>
        <div className={css.read_the_docs}>
          <ReadDocsButton />
        </div>

        <div className={`${css.footer_logo} ${css.starting_section}`}>Comm</div>
        <div className={`${css.subscribe_updates} ${css.starting_section}`}>
          <SubscriptionForm />
        </div>
      </div>
    </div>
  );
}

export default Landing;
