import request from 'supertest';
import type { TestApp } from '../../setup/app.factory.js';
import { authCookie } from '../../setup/auth.helper.js';

// Monday to Friday, 8:00 - 18:00
export const FRAME = {
  name: 'Planning Lucas',
  firstDay: 1,
  dayCount: 5,
  startMinute: 480,
  endMinute: 1080,
};

export const DEFAULT_CATEGORIES = [
  { name: 'Vert', color: 1 },
  { name: 'Orange', color: 2 },
  { name: 'Bleu', color: 3 },
  { name: 'Violet', color: 4 },
  { name: 'Jaune', color: 5 },
];

export type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';

export const api =
  (t: TestApp, token: string) =>
  (method: Method, path: string, body?: object) => {
    const req = request(t.http)[method](path).set(authCookie(token));
    return body ? req.send(body) : req;
  };

export async function createPlanning(
  t: TestApp,
  token: string,
  body: object = {},
): Promise<{
  id: string;
  categories: { id: string; name: string }[];
  events: { id: string }[];
}> {
  const res = await api(t, token)('post', '/plannings', {
    ...FRAME,
    categories: DEFAULT_CATEGORIES,
    ...body,
  }).expect(201);
  return res.body;
}
