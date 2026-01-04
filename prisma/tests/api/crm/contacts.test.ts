import { describe, it, expect, beforeAll, afterAll } from 'bun:test';

describe('Contact API', () => {
  beforeAll(async () => {
    // Setup test database
  });

  afterAll(async () => {
    // Cleanup
  });

  it('should list contacts', async () => {
    const response = await fetch('http://localhost:3000/api/crm/contacts');
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty('contacts');
    expect(data).toHaveProperty('pagination');
  });

  it('should create a contact', async () => {
    const response = await fetch('http://localhost:3000/api/crm/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        createdBy: 'admin-id'
      })
    });
    expect(response.status).toBe(201);
  });
});