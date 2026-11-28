import { PlanningUserDeletedListener } from './user-deleted.listener.js';
import type { PlanningsService } from './plannings.service.js';

describe('PlanningUserDeletedListener', () => {
  it('should delete all plannings of the deleted user', async () => {
    const planningsService = {
      removeAllOfOwner: vi.fn().mockResolvedValue(undefined),
    };
    const listener = new PlanningUserDeletedListener(
      planningsService as unknown as PlanningsService,
    );

    await listener.handle({ userId: 'user-1' });

    expect(planningsService.removeAllOfOwner).toHaveBeenCalledWith('user-1');
  });
});
