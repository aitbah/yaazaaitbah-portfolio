'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  fetchProfile,
  saveProfile,
  uploadPhoto,
  uploadResume,
  type Profile,
} from './profile-api';
import type { ProfileInput } from './profile-schema';

const PROFILE_QUERY_KEY = ['profile'] as const;

/**
 * `profile` is `null` once the read succeeded and found nothing, so the caller
 * can tell an empty profile from one still loading or one that failed to load.
 */
export function useProfile() {
  const { data, isPending, error } = useQuery({
    queryKey: PROFILE_QUERY_KEY,
    queryFn: fetchProfile,
  });

  return { profile: data ?? null, isPending, error };
}

export function useSaveProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ProfileInput) => saveProfile(input),
    meta: { notice: 'saved' },
    onSuccess: (profile: Profile) => {
      // The response already carries the saved profile, so re-reading it would
      // only ask the server for what it just answered.
      queryClient.setQueryData(PROFILE_QUERY_KEY, profile);
    },
  });
}

/**
 * The upload stands alone: it stores a file and answers with its path, which
 * only becomes the profile's photo when the form is saved.
 */
export function useUploadPhoto() {
  return useMutation({ mutationFn: (file: File) => uploadPhoto(file) });
}

/** As above: uploading stores a file but changes no profile until it is saved. */
export function useUploadResume() {
  return useMutation({ mutationFn: (file: File) => uploadResume(file) });
}
