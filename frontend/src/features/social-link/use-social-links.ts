'use client';

import { useQuery } from '@tanstack/react-query';

import { useInvalidatingMutation } from '@/lib/mutations';

import {
  createSocialLink,
  deleteSocialLink,
  fetchSocialLinks,
  updateSocialLink,
} from './social-link-api';
import type { SocialLinkInput } from './social-link-schema';

/** Exported so the reorder hook invalidates the same list it reordered. */
export const SOCIAL_LINKS_QUERY_KEY = ['social-links'] as const;

export function useSocialLinks() {
  const { data, isPending, error } = useQuery({
    queryKey: SOCIAL_LINKS_QUERY_KEY,
    queryFn: fetchSocialLinks,
  });

  return { socialLinks: data ?? [], isPending, error };
}

export function useCreateSocialLink() {
  return useInvalidatingMutation(
    SOCIAL_LINKS_QUERY_KEY,
    (input: SocialLinkInput) => createSocialLink(input),
    'created',
  );
}

export function useUpdateSocialLink() {
  return useInvalidatingMutation(
    SOCIAL_LINKS_QUERY_KEY,
    ({ id, input }: { id: string; input: SocialLinkInput }) =>
      updateSocialLink(id, input),
    'saved',
  );
}

export function useDeleteSocialLink() {
  return useInvalidatingMutation(
    SOCIAL_LINKS_QUERY_KEY,
    (id: string) => deleteSocialLink(id),
    'deleted',
  );
}
