import { createContext, useCallback, useContext, useEffect, useState } from 'react';

import { isDeepEqual } from 'remeda';

import { getLimits } from '../client';
import { DEFAULT_MINIMUM_ENVELOPE_ITEM_COUNT, FREE_PLAN_LIMITS } from '../constants';
import type { TLimitsResponseSchema } from '../schema';

export type LimitsContextValue = TLimitsResponseSchema & { refreshLimits: () => Promise<void> };

const LimitsContext = createContext<LimitsContextValue | null>(null);

export const useLimits = () => {
  const limits = useContext(LimitsContext);

  if (!limits) {
    throw new Error('useLimits must be used within a LimitsProvider');
  }

  return limits;
};

export type LimitsProviderProps = {
  initialValue?: TLimitsResponseSchema;

  /**
   * Bypass limits for embed authoring. This is just client side bypass since
   * all embeds should be paid plans.
   */
  disableLimitsFetch?: boolean;
  teamId: number;
  children?: React.ReactNode;
};

export const LimitsProvider = ({
  initialValue = {
    quota: FREE_PLAN_LIMITS,
    remaining: FREE_PLAN_LIMITS,
    maximumEnvelopeItemCount: DEFAULT_MINIMUM_ENVELOPE_ITEM_COUNT,
  },
  disableLimitsFetch,
  teamId,
  children,
}: LimitsProviderProps) => {
  const [limits, setLimits] = useState(() => initialValue);

  const refreshLimits = useCallback(async () => {
    if (disableLimitsFetch) {
      return;
    }

    const newLimits = await getLimits({ teamId });

    setLimits((oldLimits) => {
      if (isDeepEqual(oldLimits, newLimits)) {
        return oldLimits;
      }

      return newLimits;
    });
  }, [teamId]);

  useEffect(() => {
    void refreshLimits();
  }, [refreshLimits]);

  useEffect(() => {
    if (disableLimitsFetch) {
      return;
    }

    // Throttled like the SessionProvider: an unthrottled focus listener made
    // every alt-tab fire a /api/limits request on top of the other refetches.
    const lastRefreshAtRef = { current: 0 };
    const REFRESH_INTERVAL_MS = 30_000;

    const onFocus = () => {
      if (Date.now() - lastRefreshAtRef.current < REFRESH_INTERVAL_MS) {
        return;
      }

      lastRefreshAtRef.current = Date.now();

      void refreshLimits();
    };

    window.addEventListener('focus', onFocus);

    return () => {
      window.removeEventListener('focus', onFocus);
    };
  }, [refreshLimits]);

  return (
    <LimitsContext.Provider
      value={{
        ...limits,
        refreshLimits,
      }}
    >
      {children}
    </LimitsContext.Provider>
  );
};
