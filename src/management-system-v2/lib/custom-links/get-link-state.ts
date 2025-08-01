import 'server-only';
import { CustomNavigationLink } from './custom-link';
import mqtt from 'mqtt';
import { LRUCache } from 'lru-cache';

// NOTE: when developing changes to the cache will not take effect until the server is restarted.
// You can just remove the global.customLinkState code
const customLinkStatusCache =
  // @ts-ignore
  (global.customLinkState as LRUCache<string, boolean>) ||
  // @ts-ignore
  (global.customLinkState = new LRUCache({
    max: 100,
    ttl: 15_000,
    ttlAutopurge: false,
    updateAgeOnGet: false,
  }));

function getCacheKey(link: CustomNavigationLink) {
  return JSON.stringify({
    l: link.address,
    t: link.topic,
  });
}

/*
 * This function needs no user verification since it is server-only
 * However functions that use do have to verify the user!
 */
export async function checkCustomLinkStatus(link: CustomNavigationLink): Promise<boolean> {
  const cacheKey = getCacheKey(link);

  const cachedStatus = customLinkStatusCache.get(cacheKey);
  if (cachedStatus !== undefined) {
    return cachedStatus;
  }

  let status = false;
  try {
    if (link.address.startsWith('http')) {
      const response = await fetch(link.address);
      status = response.ok;
    } else if (link.address.startsWith('mqtt')) {
      // TODO: cache connections, but also different solution for serverless deployments.
      await mqtt
        .connectAsync(link.address)
        .then((client) => {
          // TODO: check topic if given.
          client.end();
          status = true;
        })
        .catch(() => (status = false));
    } else {
      throw new Error('Unsupported URL protocol');
    }
  } catch (_) {}

  customLinkStatusCache.set(cacheKey, status);
  return status;
}
