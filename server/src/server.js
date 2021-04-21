// @flow

import cluster from 'cluster';
import cookieParser from 'cookie-parser';
import express from 'express';
import expressWs from 'express-ws';
import os from 'os';

import './cron/cron';
import { jsonEndpoints } from './endpoints';
import {
  jsonHandler,
  downloadHandler,
  htmlHandler,
  uploadHandler,
} from './responders/handlers';
import landingHandler from './responders/landing-handler';
import { errorReportDownloadResponder } from './responders/report-responders';
import { websiteResponder } from './responders/website-responders';
import { onConnection } from './socket/socket';
import {
  multerProcessor,
  multimediaUploadResponder,
  uploadDownloadResponder,
} from './uploads/uploads';
import { getGlobalURLFacts } from './utils/urls';

const { baseRoutePath } = getGlobalURLFacts();

if (cluster.isMaster) {
  const cpuCount = os.cpus().length;
  for (let i = 0; i < cpuCount; i++) {
    cluster.fork();
  }
  cluster.on('exit', () => cluster.fork());
} else {
  const server = express();
  expressWs(server);
  server.use(express.json({ limit: '50mb' }));
  server.use(cookieParser());

  const router = express.Router();
  router.use('/images', express.static('images'));
  if (process.env.NODE_ENV === 'dev') {
    router.use('/fonts', express.static('fonts'));
  }
  router.use('/misc', express.static('misc'));
  router.use(
    '/.well-known',
    express.static(
      '.well-known',
      // Necessary for apple-app-site-association file
      {
        setHeaders: res => res.setHeader('Content-Type', 'application/json'),
      },
    ),
  );
  const compiledFolderOptions =
    process.env.NODE_ENV === 'dev'
      ? undefined
      : { maxAge: '1y', immutable: true };
  router.use(
    '/compiled',
    express.static('app_compiled', compiledFolderOptions),
  );
  router.use(
    '/commlanding/compiled',
    express.static('landing_compiled', compiledFolderOptions),
  );
  router.use('/', express.static('icons'));

  for (const endpoint in jsonEndpoints) {
    // $FlowFixMe Flow thinks endpoint is string
    const responder = jsonEndpoints[endpoint];
    const expectCookieInvalidation = endpoint === 'log_out';
    router.post(
      `/${endpoint}`,
      jsonHandler(responder, expectCookieInvalidation),
    );
  }

  router.get(
    '/download_error_report/:reportID',
    downloadHandler(errorReportDownloadResponder),
  );
  router.get(
    '/upload/:uploadID/:secret',
    downloadHandler(uploadDownloadResponder),
  );

  // $FlowFixMe express-ws has side effects that can't be typed
  router.ws('/ws', onConnection);
  router.get('/commlanding/*', landingHandler);
  router.get('*', htmlHandler(websiteResponder));

  router.post(
    '/upload_multimedia',
    multerProcessor,
    uploadHandler(multimediaUploadResponder),
  );

  server.use(baseRoutePath, router);
  server.listen(parseInt(process.env.PORT, 10) || 3000, 'localhost');
}
