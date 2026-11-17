export interface ShopMembership {
  shop_id: string;
  role: string;
  created_at: string;
}

export interface ShopDetails {
  id: string;
  name: string;
  phone: string | null;
  created_at: string;
  callerRole?: string;
}

interface MembershipResponse {
  success: boolean;
  memberships: ShopMembership[];
}

interface ShopDetailsResponse {
  success: boolean;
  shop: ShopDetails;
}

interface LoadShopMembershipsOptions {
  getIdToken: (forceRefresh: boolean) => Promise<string>;
  apiBaseUrl: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  fetcher?: typeof fetch;
}

interface LoadShopDetailsOptions extends LoadShopMembershipsOptions {
  shopId: string;
}

export async function loadShopMemberships({
  getIdToken,
  apiBaseUrl,
  signal,
  timeoutMs = 15000,
  fetcher = fetch,
}: LoadShopMembershipsOptions): Promise<ShopMembership[]> {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;

  const abortPromise = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(new Error('Shop membership request timed out.'));
    }, timeoutMs);

    if (signal) {
      onAbort = () => {
        controller.abort();
        reject(new DOMException('Shop membership request was cancelled.', 'AbortError'));
      };

      if (signal.aborted) {
        onAbort();
      } else {
        signal.addEventListener('abort', onAbort, { once: true });
      }
    }
  });

  const request = (async () => {
    const idToken = await getIdToken(true);
    if (controller.signal.aborted) {
      throw new DOMException('Shop membership request was cancelled.', 'AbortError');
    }
    if (!idToken.trim()) {
      throw new Error('Authentication token is unavailable.');
    }

    const response = await fetcher(
      `${apiBaseUrl.replace(/\/+$/, '')}/shops/memberships`,
      {
        headers: {
          Authorization: `Bearer ${idToken}`,
          Accept: 'application/json',
        },
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      throw new Error('Shop membership request failed.');
    }

    const result = (await response.json()) as MembershipResponse;
    if (
      result?.success !== true ||
      !Array.isArray(result.memberships) ||
      result.memberships.some((membership) =>
        !membership ||
        typeof membership.shop_id !== 'string' ||
        typeof membership.role !== 'string'
      )
    ) {
      throw new Error('Shop membership response was invalid.');
    }

    return result.memberships;
  })();

  try {
    return await Promise.race([request, abortPromise]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    if (signal && onAbort) signal.removeEventListener('abort', onAbort);
  }
}

export async function loadShopDetails({
  shopId,
  getIdToken,
  apiBaseUrl,
  signal,
  timeoutMs = 15000,
  fetcher = fetch,
}: LoadShopDetailsOptions): Promise<ShopDetails> {
  if (!shopId.trim()) {
    throw new Error('Shop ID is required.');
  }

  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;

  const abortPromise = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(new Error('Shop details request timed out.'));
    }, timeoutMs);

    if (signal) {
      onAbort = () => {
        controller.abort();
        reject(new DOMException('Shop details request was cancelled.', 'AbortError'));
      };

      if (signal.aborted) {
        onAbort();
      } else {
        signal.addEventListener('abort', onAbort, { once: true });
      }
    }
  });

  const request = (async () => {
    const idToken = await getIdToken(false);
    if (controller.signal.aborted) {
      throw new DOMException('Shop details request was cancelled.', 'AbortError');
    }
    if (!idToken.trim()) {
      throw new Error('Authentication token is unavailable.');
    }

    const response = await fetcher(
      `${apiBaseUrl.replace(/\/+$/, '')}/shops/${encodeURIComponent(shopId)}`,
      {
        headers: {
          Authorization: `Bearer ${idToken}`,
          Accept: 'application/json',
        },
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      throw new Error('Shop details request failed.');
    }

    const result = (await response.json()) as ShopDetailsResponse;
    if (
      result?.success !== true ||
      !result.shop ||
      typeof result.shop.id !== 'string' ||
      typeof result.shop.name !== 'string'
    ) {
      throw new Error('Shop details response was invalid.');
    }

    return result.shop;
  })();

  try {
    return await Promise.race([request, abortPromise]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    if (signal && onAbort) signal.removeEventListener('abort', onAbort);
  }
}

export interface RegisterShopOptions extends LoadShopMembershipsOptions {
  shopName: string;
  phone?: string | null;
}

export interface UpdateShopDetailsOptions extends LoadShopMembershipsOptions {
  shopId: string;
  shopName?: string;
  phone?: string | null;
}

interface RegisterShopResponse {
  success: boolean;
  shop: ShopDetails;
  membership: ShopMembership;
}

export async function registerShop({
  shopName,
  phone,
  getIdToken,
  apiBaseUrl,
  signal,
  timeoutMs = 15000,
  fetcher = fetch,
}: RegisterShopOptions): Promise<{ shop: ShopDetails; membership: ShopMembership }> {
  if (!shopName.trim()) {
    throw new Error('Shop name is required.');
  }

  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;

  const abortPromise = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(new Error('Shop registration request timed out.'));
    }, timeoutMs);

    if (signal) {
      onAbort = () => {
        controller.abort();
        reject(new DOMException('Shop registration request was cancelled.', 'AbortError'));
      };

      if (signal.aborted) {
        onAbort();
      } else {
        signal.addEventListener('abort', onAbort, { once: true });
      }
    }
  });

  const request = (async () => {
    const idToken = await getIdToken(true);
    if (controller.signal.aborted) {
      throw new DOMException('Shop registration request was cancelled.', 'AbortError');
    }
    if (!idToken.trim()) {
      throw new Error('Authentication token is unavailable.');
    }

    const response = await fetcher(
      `${apiBaseUrl.replace(/\/+$/, '')}/shops/register`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          shopName: shopName.trim(),
          phone: phone ? phone.trim() : null,
        }),
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      const errJson = await response.json().catch(() => null);
      throw new Error(errJson?.message || 'Shop registration request failed.');
    }

    const result = (await response.json()) as RegisterShopResponse;
    if (result?.success !== true || !result.shop) {
      throw new Error('Shop registration response was invalid.');
    }

    return { shop: result.shop, membership: result.membership };
  })();

  try {
    return await Promise.race([request, abortPromise]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    if (signal && onAbort) signal.removeEventListener('abort', onAbort);
  }
}

export async function updateShopDetails({
  shopId,
  shopName,
  phone,
  getIdToken,
  apiBaseUrl,
  signal,
  timeoutMs = 15000,
  fetcher = fetch,
}: UpdateShopDetailsOptions): Promise<ShopDetails> {
  if (!shopId.trim()) {
    throw new Error('Shop ID is required.');
  }

  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;

  const abortPromise = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(new Error('Shop update request timed out.'));
    }, timeoutMs);

    if (signal) {
      onAbort = () => {
        controller.abort();
        reject(new DOMException('Shop update request was cancelled.', 'AbortError'));
      };

      if (signal.aborted) {
        onAbort();
      } else {
        signal.addEventListener('abort', onAbort, { once: true });
      }
    }
  });

  const request = (async () => {
    const idToken = await getIdToken(true);
    if (controller.signal.aborted) {
      throw new DOMException('Shop update request was cancelled.', 'AbortError');
    }
    if (!idToken.trim()) {
      throw new Error('Authentication token is unavailable.');
    }

    const payload: { shopName?: string; phone?: string | null } = {};
    if (shopName !== undefined) payload.shopName = shopName.trim();
    if (phone !== undefined) payload.phone = phone ? phone.trim() : null;

    const response = await fetcher(
      `${apiBaseUrl.replace(/\/+$/, '')}/shops/${encodeURIComponent(shopId)}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      const errJson = await response.json().catch(() => null);
      throw new Error(errJson?.message || 'Shop update request failed.');
    }

    const result = (await response.json()) as ShopDetailsResponse;
    if (result?.success !== true || !result.shop) {
      throw new Error('Shop update response was invalid.');
    }

    return result.shop;
  })();

  try {
    return await Promise.race([request, abortPromise]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    if (signal && onAbort) signal.removeEventListener('abort', onAbort);
  }
}
