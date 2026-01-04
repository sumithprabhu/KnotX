/**
 * Creating a sidebar enables you to:
 - create an ordered group of docs
 - render a sidebar for each doc of that group
 - provide next/previous navigation

 The sidebars can be generated from the filesystem, or explicitly defined here.

 Create as many sidebars as you want.
 */

// @ts-check

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  messaging: [
    {
      type: 'html',
      value: '<div style="font-size: 0.875rem; font-weight: 600; color: var(--ifm-color-content); padding: 0.5rem 0.75rem; margin-top: 0.5rem; display: flex; align-items: center; gap: 0.5rem;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>Messaging</div>',
      defaultStyle: true,
    },
    {
      type: 'doc',
      id: 'overview',
      label: 'Overview',
    },
    {
      type: 'doc',
      id: 'get-started',
      label: 'Get Started',
    },
    {
      type: 'category',
      label: 'Guides',
      items: [
        'guides/sending-messages',
        'guides/receiving-messages',
        'guides/message-format',
        'guides/error-handling',
      ],
    },
    {
      type: 'category',
      label: 'Concepts',
      items: [
        'concepts/architecture',
        'concepts/message-flow',
        'concepts/security-model',
        'concepts/relayer-system',
      ],
    },
    {
      type: 'doc',
      id: 'tutorial',
      label: 'Tutorial',
    },
    {
      type: 'doc',
      id: 'contracts',
      label: 'Contracts',
    },
  ],
};

module.exports = sidebars;

