interface JWTPayload {
  sub: string;
  iat: number;
  exp: number;
  authorities?: Array<{ authority: string }>;
}

export function decodeJWT(token: string): JWTPayload | null {
  try {

    const parts = token.split('.');
    if (parts.length !== 3) {
      console.warn('Invalid token format');
      return null;
    }

    const payload = parts[1];
    const decodedPayload = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    
    return JSON.parse(decodedPayload) as JWTPayload;
  } catch (e) {
    console.error('Failed to decode token:', e);
    return null;
  }
}

export function isTokenExpired(token: string): boolean {
  const payload = decodeJWT(token);
  
  if (!payload || !payload.exp) {
    return true;
  }

  const currentTime = Date.now() / 1000;
  const isExpired = currentTime >= payload.exp;

  if (isExpired) {
    console.log('Token expired at:', new Date(payload.exp * 1000).toISOString());
  }

  return isExpired;
}

export function getTokenExpiresIn(token: string): number | null {
  const payload = decodeJWT(token);
  
  if (!payload || !payload.exp) {
    return null;
  }

  const currentTime = Date.now() / 1000;
  const expiresIn = payload.exp - currentTime;

  return expiresIn > 0 ? expiresIn : 0;
}