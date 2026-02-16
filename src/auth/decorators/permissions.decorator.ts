import { SetMetadata } from '@nestjs/common';
import { Permission } from '../permissions.constants.js';

// Clé utilisée pour stocker les permissions requises dans les métadonnées de la route
export const PERMISSIONS_KEY = 'permissions';

// Décorateur : @RequirePermissions(Permissions.USER_READ)
// Stocke la liste des permissions nécessaires, lue ensuite par le PermissionsGuard
// Typé avec Permission → TypeScript refuse les valeurs inconnues
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
