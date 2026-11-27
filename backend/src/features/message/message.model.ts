import {
  Schema,
  model,
  type HydratedDocument,
  type InferSchemaType,
} from 'mongoose';

import {
  MAX_MESSAGE_BODY_LENGTH,
  MAX_MESSAGE_NAME_LENGTH,
  MAX_MESSAGE_SUBJECT_LENGTH,
} from '@portfolio/shared';

/**
 * What someone sent through the contact form. Not localized: a message is what
 * one person wrote, in whatever language they wrote it.
 *
 * Nothing here is ever edited. The only mutable field is `read`, which is the
 * owner's bookkeeping rather than part of what was sent.
 */
const messageSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: MAX_MESSAGE_NAME_LENGTH,
    },
    email: { type: String, required: true, trim: true, lowercase: true },
    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: MAX_MESSAGE_SUBJECT_LENGTH,
    },
    body: {
      type: String,
      required: true,
      trim: true,
      maxlength: MAX_MESSAGE_BODY_LENGTH,
    },
    read: { type: Boolean, default: false },
  },
  { timestamps: true },
);

/** Newest first: an inbox is read from the top. */
export const MESSAGE_SORT = { createdAt: -1 } as const;

/** The list's sort, which runs on every inbox load. */
messageSchema.index({ createdAt: -1 });

/** The unread count runs beside it, and would otherwise scan the collection. */
messageSchema.index({ read: 1 });

type Message = InferSchemaType<typeof messageSchema>;
export type MessageDocument = HydratedDocument<Message>;

export const MessageModel = model('Message', messageSchema);
