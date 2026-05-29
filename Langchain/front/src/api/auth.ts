import { fetchAPI } from './client';
import type { User } from '../types';

export async function register(email: string, password: string): Promise<{ user: User }> {
  const response = await fetchAPI('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  return response.json();
}

export async function login(email: string, password: string): Promise<{ user: User }> {
  const response = await fetchAPI('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  return response.json();
}

export async function logout(): Promise<void> {
  await fetchAPI('/auth/logout', { method: 'POST' });
}

export async function getMe(): Promise<{ user: User }> {
  const response = await fetchAPI('/auth/me');
  return response.json();
}
