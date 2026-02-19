import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator.js';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 1. Lire les permissions requises par le décorateur @RequirePermissions()
    const requiredPermissions = this.reflector.getAllAndMerge<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Si pas de décorateur @RequirePermissions → accès libre
    if (!requiredPermissions) {
      return true;
    }

    // 2. Récupérer l'utilisateur (rempli par JwtStrategy.validate())
    const { user } = context.switchToHttp().getRequest();

    // 3. Vérifier que l'utilisateur possède TOUTES les permissions requises
    return requiredPermissions.every((permission) =>
      user.permissions?.includes(permission),
    );
  }
}
