import { SetMetadata } from '@nestjs/common';
import { ApiExtension } from '@nestjs/swagger';
import { Permission } from '../permissions.constants.js';

export const PERMISSIONS_KEY = 'permissions';

export function RequirePermissions(
  ...permissions: Permission[]
): ClassDecorator & MethodDecorator {
  return (
    target: object,
    propertyKey?: string | symbol,
    descriptor?: PropertyDescriptor,
  ): any => {
    SetMetadata(PERMISSIONS_KEY, permissions)(
      target as any,
      propertyKey as string,
      descriptor as PropertyDescriptor,
    );
    if (propertyKey === undefined) {
      ApiExtension('x-class-permissions', permissions)(target as any);
    } else {
      ApiExtension('x-required-permissions', permissions)(
        target,
        propertyKey as string,
        descriptor as PropertyDescriptor,
      );
    }
  };
}
