import React from 'react';
import ComponentCreator from '@docusaurus/ComponentCreator';

export default [
  {
    path: '/docs/',
    component: ComponentCreator('/docs/', '318'),
    routes: [
      {
        path: '/docs/',
        component: ComponentCreator('/docs/', '323'),
        routes: [
          {
            path: '/docs/',
            component: ComponentCreator('/docs/', '21b'),
            routes: [
              {
                path: '/docs/concepts/architecture',
                component: ComponentCreator('/docs/concepts/architecture', 'c76'),
                exact: true,
                sidebar: "messaging"
              },
              {
                path: '/docs/concepts/message-flow',
                component: ComponentCreator('/docs/concepts/message-flow', '8c9'),
                exact: true,
                sidebar: "messaging"
              },
              {
                path: '/docs/concepts/relayer-system',
                component: ComponentCreator('/docs/concepts/relayer-system', '0a7'),
                exact: true,
                sidebar: "messaging"
              },
              {
                path: '/docs/concepts/security-model',
                component: ComponentCreator('/docs/concepts/security-model', '761'),
                exact: true,
                sidebar: "messaging"
              },
              {
                path: '/docs/contracts',
                component: ComponentCreator('/docs/contracts', '0b5'),
                exact: true,
                sidebar: "messaging"
              },
              {
                path: '/docs/get-started',
                component: ComponentCreator('/docs/get-started', '053'),
                exact: true,
                sidebar: "messaging"
              },
              {
                path: '/docs/guides/error-handling',
                component: ComponentCreator('/docs/guides/error-handling', '288'),
                exact: true,
                sidebar: "messaging"
              },
              {
                path: '/docs/guides/message-format',
                component: ComponentCreator('/docs/guides/message-format', 'c0e'),
                exact: true,
                sidebar: "messaging"
              },
              {
                path: '/docs/guides/receiving-messages',
                component: ComponentCreator('/docs/guides/receiving-messages', 'ff9'),
                exact: true,
                sidebar: "messaging"
              },
              {
                path: '/docs/guides/sending-messages',
                component: ComponentCreator('/docs/guides/sending-messages', '8c8'),
                exact: true,
                sidebar: "messaging"
              },
              {
                path: '/docs/overview',
                component: ComponentCreator('/docs/overview', '024'),
                exact: true,
                sidebar: "messaging"
              },
              {
                path: '/docs/tutorial',
                component: ComponentCreator('/docs/tutorial', 'a31'),
                exact: true,
                sidebar: "messaging"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    path: '*',
    component: ComponentCreator('*'),
  },
];
