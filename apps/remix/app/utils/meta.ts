import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { i18n, type MessageDescriptor } from '@lingui/core';

export const appMetaTags = (title?: MessageDescriptor) => {
  const description =
    'Open Mic Productions digital signing for agreements, contracts and more. Sign documents securely and get them done faster.';

  return [
    {
      title: title ? `${i18n._(title)} - Open Mic Productions` : 'Open Mic Productions',
    },
    {
      name: 'description',
      content: description,
    },
    {
      name: 'keywords',
      content: 'Open Mic Productions, digital signing, document signing, e-signature, agreements, contracts',
    },
    {
      name: 'author',
      content: 'Open Mic Productions',
    },
    {
      name: 'robots',
      content: 'index, follow',
    },
    {
      property: 'og:title',
      content: 'Open Mic Productions - Digital Signing',
    },
    {
      property: 'og:description',
      content: description,
    },
    {
      property: 'og:image',
      content: `${NEXT_PUBLIC_WEBAPP_URL()}/opengraph-image.jpg`,
    },
    {
      property: 'og:type',
      content: 'website',
    },
    {
      name: 'twitter:card',
      content: 'summary_large_image',
    },
    {
      name: 'twitter:site',
      content: '@documenso',
    },
    {
      name: 'twitter:description',
      content: description,
    },
    {
      name: 'twitter:image',
      content: `${NEXT_PUBLIC_WEBAPP_URL()}/opengraph-image.jpg`,
    },
  ];
};
