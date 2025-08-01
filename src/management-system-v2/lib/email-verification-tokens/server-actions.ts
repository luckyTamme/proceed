'use server';

import { z } from 'zod';
import { userError } from '../user-error';
import { createChangeEmailVerificationToken, getTokenHash, notExpired } from './utils';
import { getCurrentUser } from '@/components/auth';
import {
  saveEmailVerificationToken,
  getEmailVerificationToken,
  deleteEmailVerificationToken,
} from '@/lib/data/db/iam/verification-tokens';
import { updateUser } from '@/lib/data/db/iam/users';
import { sendEmail } from '../email/mailer';
import renderSigninLinkEmail from '../email/signin-link-email';

export async function requestEmailChange(newEmail: string) {
  try {
    const { session } = await getCurrentUser();
    if (!session || session.user.isGuest)
      return userError('You must be signed in to change your email');
    const userId = session.user.id;

    const email = z.string().email().parse(newEmail);

    const { verificationToken, redirectUrl } = await createChangeEmailVerificationToken({
      email,
      userId,
    });

    await saveEmailVerificationToken(verificationToken);

    const signinMail = renderSigninLinkEmail({
      signInLink: redirectUrl,
      expires: verificationToken.expiresAt,
      headerText: 'Change your email address',
      description:
        'Hi, you have requested to change the email address associated with your PROCEED account. Please click the link below to confirm this change:',
      footerText:
        'If you did not request this email change, you can ignore this email. Your account remains secure and can only be accessed with your original email address. The PROCEED Crew',
    });

    await sendEmail({
      to: email,
      subject: 'PROCEED: Change your email address',
      html: signinMail.html,
      text: signinMail.text,
    });
  } catch (e) {
    if (e instanceof z.ZodError) return userError('Invalid email');

    return userError('Something went wrong');
  }
}

export async function changeEmail(token: string, identifier: string, cancel: boolean = false) {
  const { session, userId } = await getCurrentUser();
  if (!session || session.user.isGuest)
    return userError('You must be signed in to change your email');

  const tokenParams = { identifier, token: await getTokenHash(token) };
  const verificationToken = await getEmailVerificationToken(tokenParams);
  if (
    !verificationToken ||
    verificationToken.type !== 'change_email' ||
    verificationToken.userId !== userId ||
    !(await notExpired(verificationToken))
  )
    return userError('Invalid token');

  if (!cancel) updateUser(userId, { email: verificationToken.identifier, isGuest: false });

  await deleteEmailVerificationToken(tokenParams);
}
