import { UserProfile } from '../types';

/**
 * Determines if a user has premium access.
 * 
 * Logic:
 * 1. If isPremium is explicitly true, they have access.
 * 2. If premiumExpiresAt is set and the current time is before that date, they have access.
 * 3. Otherwise, they do not have access.
 */
export function hasPremiumAccess(profile: UserProfile | null | undefined): boolean {
  if (!profile) return false;

  if (profile.isPremium === true) {
    return true;
  }

  if (profile.premiumExpiresAt) {
    const expiresAt = new Date(profile.premiumExpiresAt);
    const now = new Date();
    if (now < expiresAt) {
      return true;
    }
  }

  return false;
}
