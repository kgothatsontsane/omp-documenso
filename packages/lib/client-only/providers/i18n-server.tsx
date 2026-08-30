import type { I18n, Messages } from '@lingui/core';
import { setupI18n } from '@lingui/core';

// Catalogs are imported as real bindings and held in a used map below, so the
// bundler keeps them in the graph and serverless tracers (nft) ship them. A
// bare side-effect import is tree-shaken; a referenced one is not.
// @ts-ignore - compiled .mjs catalogs ship without type declarations
import * as deCatalog from '../../translations/de/web.mjs';
// @ts-ignore
import * as enCatalog from '../../translations/en/web.mjs';
// @ts-ignore
import * as frCatalog from '../../translations/fr/web.mjs';
// @ts-ignore
import * as esCatalog from '../../translations/es/web.mjs';
// @ts-ignore
import * as itCatalog from '../../translations/it/web.mjs';
// @ts-ignore
import * as nlCatalog from '../../translations/nl/web.mjs';
// @ts-ignore
import * as plCatalog from '../../translations/pl/web.mjs';
// @ts-ignore
import * as ptBrCatalog from '../../translations/pt-BR/web.mjs';
// @ts-ignore
import * as jaCatalog from '../../translations/ja/web.mjs';
// @ts-ignore
import * as koCatalog from '../../translations/ko/web.mjs';
// @ts-ignore
import * as zhCatalog from '../../translations/zh/web.mjs';

import { APP_I18N_OPTIONS, isValidLanguageCode, SUPPORTED_LANGUAGE_CODES } from '../../constants/i18n';
import { env } from '../../utils/env';
import { remember } from '../../utils/remember';

type SupportedLanguages = (typeof SUPPORTED_LANGUAGE_CODES)[number];

const staticCatalogs: Record<string, { messages: Messages }> = {
  de: deCatalog as { messages: Messages },
  en: enCatalog as { messages: Messages },
  fr: frCatalog as { messages: Messages },
  es: esCatalog as { messages: Messages },
  it: itCatalog as { messages: Messages },
  nl: nlCatalog as { messages: Messages },
  pl: plCatalog as { messages: Messages },
  'pt-BR': ptBrCatalog as { messages: Messages },
  ja: jaCatalog as { messages: Messages },
  ko: koCatalog as { messages: Messages },
  zh: zhCatalog as { messages: Messages },
};

export async function loadCatalog(lang: SupportedLanguages): Promise<{
  [k: string]: Messages;
}> {
  // Development still reads .po at runtime; production uses the bundled .mjs.
  if (env('NODE_ENV') === 'development') {
    try {
      const { messages } = await import(`../../translations/${lang}/web.po`);
      return { [lang]: messages };
    } catch (error) {
      console.warn(`[i18n] Failed to load ${lang} catalog; using empty messages.`, error);
      return { [lang]: {} };
    }
  }

  const catalog = staticCatalogs[lang];
  return { [lang]: catalog?.messages ?? {} };
}

const catalogs = Promise.all(SUPPORTED_LANGUAGE_CODES.map(loadCatalog));

// transform array of catalogs into a single object
const allMessages = async () => {
  return await catalogs.then((catalogs) =>
    catalogs.reduce((acc, oneCatalog) => {
      return {
        ...acc,
        ...oneCatalog,
      };
    }, {}),
  );
};

type AllI18nInstances = { [K in SupportedLanguages]: I18n };

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
export const allI18nInstances = remember('i18n.allI18nInstances', async () => {
  const loadedMessages = await allMessages();

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return SUPPORTED_LANGUAGE_CODES.reduce((acc, lang) => {
    const messages = loadedMessages[lang] ?? {};

    const i18n = setupI18n({
      locale: lang,
      messages: { [lang]: messages },
    });

    return { ...acc, [lang]: i18n };
  }, {}) as AllI18nInstances;
});

// eslint-disable-next-line @typescript-eslint/ban-types
export const getI18nInstance = async (lang?: SupportedLanguages | (string & {})) => {
  const instances = await allI18nInstances;

  if (!isValidLanguageCode(lang)) {
    return instances[APP_I18N_OPTIONS.sourceLang];
  }

  return instances[lang] ?? instances[APP_I18N_OPTIONS.sourceLang];
};
