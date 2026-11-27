import { SetMetadata } from '@nestjs/common';

export const ADMIN_ORIGIN_ONLY = 'adminOriginOnly';
export const AdminOriginOnly = () => SetMetadata(ADMIN_ORIGIN_ONLY, true);
