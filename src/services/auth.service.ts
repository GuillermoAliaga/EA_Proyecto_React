import { request } from './http';

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export const authService = {
  register: (payload: RegisterInput) =>
    request<unknown>('/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
};