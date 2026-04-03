import { ShoplineApiError } from '../utils/errors';
import { logger } from '../utils/logger';

const SHOPLINE_API_VERSION = '2024-01';

export interface ShoplineOrderTag {
  orderId: string;
  shopDomain: string;
  accessToken: string;
  tags: string[];
}

/**
 * Tag a Shopline order with the assigned blind box item SKU.
 * This function calls the Shopline REST Admin API.
 */
export async function tagOrder(params: ShoplineOrderTag): Promise<void> {
  // TODO: Implement actual Shopline Order API call when credentials are available.
  // The API endpoint would be:
  // PUT https://{shopDomain}/admin/api/{version}/orders/{orderId}.json
  // Body: { order: { tags: params.tags.join(', ') } }
  // Headers: { 'X-Shopline-Access-Token': params.accessToken }
  logger.info('Shopline order tag (stub)', {
    orderId: params.orderId,
    shopDomain: params.shopDomain,
    tags: params.tags,
  });
}

/**
 * Exchange OAuth code for an access token.
 */
export async function exchangeCodeForToken(
  shopDomain: string,
  code: string
): Promise<string> {
  const url = `https://${shopDomain}/admin/oauth/access_token`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.SHOPLINE_API_KEY,
        client_secret: process.env.SHOPLINE_API_SECRET,
        code,
      }),
    });
  } catch (err) {
    throw new ShoplineApiError('Failed to reach Shopline OAuth endpoint', err);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new ShoplineApiError(
      `OAuth token exchange failed: ${response.status} ${text}`
    );
  }

  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new ShoplineApiError('OAuth response missing access_token');
  }

  return data.access_token;
}

/**
 * Build the OAuth authorization URL for the install flow.
 */
export function buildAuthUrl(shopDomain: string, state: string): string {
  const scopes = process.env.SHOPLINE_SCOPES || 'read_orders,write_orders,read_products';
  const redirectUri = `${process.env.APP_URL}/api/shopline/callback`;
  const apiKey = process.env.SHOPLINE_API_KEY;

  const params = new URLSearchParams({
    client_id: apiKey!,
    scope: scopes,
    redirect_uri: redirectUri,
    state,
    response_type: 'code',
  });

  return `https://${shopDomain}/admin/oauth/authorize?${params.toString()}`;
}
