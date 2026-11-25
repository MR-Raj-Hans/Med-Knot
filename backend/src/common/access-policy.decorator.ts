import { SetMetadata } from '@nestjs/common';

export const ACCESS_POLICY_KEY = 'medknot:access-policy';
export type AccessPolicy = { roles?: string[]; permissions?: string[] };
export const AccessPolicy = (policy: AccessPolicy) => SetMetadata(ACCESS_POLICY_KEY, policy);
