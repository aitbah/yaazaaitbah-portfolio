import { apiFetch } from '@/lib/api-client';

import type { MessageInput } from './message-schema';

/** A message as the API returns it - see docs/api-endpoints/messages-api.md. */
export type Message = {
  id: string;
  name: string;
  email: string;
  subject: string;
  body: string;
  read: boolean;
  receivedAt: string;
};

export type Inbox = {
  messages: Message[];
  unread: number;
  page: number;
  pageSize: number;
  /** Every message, not just this page - what the pager counts through. */
  total: number;
};

export async function fetchMessages(page: number): Promise<Inbox> {
  return apiFetch<Inbox>(`/api/messages?page=${page}`);
}

export async function setMessageRead(
  id: string,
  read: boolean,
): Promise<Message> {
  const { message } = await apiFetch<{ message: Message }>(
    `/api/messages/${id}/read`,
    { method: 'PATCH', body: JSON.stringify({ read }) },
  );

  return message;
}

export async function deleteMessage(id: string): Promise<void> {
  await apiFetch(`/api/messages/${id}`, { method: 'DELETE' });
}

/**
 * The only write a visitor can make.
 *
 * The API answers with nothing at all - no id, no echo of what was stored -
 * so there is nothing to return. That is deliberate on its side: echoing the
 * values back would turn the endpoint into a way to probe what validation
 * accepts.
 */
export async function sendMessage(input: MessageInput): Promise<void> {
  await apiFetch('/api/messages', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
