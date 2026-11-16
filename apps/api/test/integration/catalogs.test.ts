import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GENERADOR, api, login, uniqueCode, uniqueDocument } from '../helpers/integration-env.js';

describe('Integración: catálogos y asignaciones', () => {
  it('crea proyecto, persona, grupo de pago y asignación', async () => {
    const session = await login(GENERADOR);
    const token = session.accessToken;

    const project = await api<{ id: string; code: string }>('/projects', {
      method: 'POST',
      token,
      body: {
        code: uniqueCode('P'),
        name: `Proyecto Integración ${uniqueCode('N')}`,
        description: 'Creado por la suite de integración',
        area: 'BIOLOGIA',
        scope: 'INTERNO',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      },
      expected: 201,
    });
    assert.ok(project.id);

    const person = await api<{ id: string; documentNumber: string }>('/persons', {
      method: 'POST',
      token,
      body: {
        documentType: 'V',
        documentNumber: uniqueDocument('DOC'),
        firstName: 'Grace',
        lastName: 'Hopper',
        email: `grace.${uniqueCode('X').toLowerCase()}@scienpay.test`,
      },
      expected: 201,
    });
    assert.ok(person.id);

    const group = await api<{ id: string }>('/payment-groups', {
      method: 'POST',
      token,
      body: {
        name: `Grupo Integración ${uniqueCode('G')}`,
        periodicity: 'QUINCENAL',
        cutOffConfig: {},
        description: 'Grupo de prueba',
      },
      expected: 201,
    });
    assert.ok(group.id);

    const assignment = await api<{ id: string }>('/assignments', {
      method: 'POST',
      token,
      body: {
        personId: person.id,
        projectId: project.id,
        paymentGroupId: group.id,
        amountPerPeriod: 250,
        currency: 'USD',
        startDate: '2026-01-01',
        endDate: '2026-03-31',
        notes: 'Asignación de integración',
      },
      expected: 201,
    });
    assert.ok(assignment.id);

    const projects = await api<Array<{ id: string }>>('/projects', { token });
    const persons = await api<Array<{ id: string }>>('/persons', { token });
    const groups = await api<Array<{ id: string }>>('/payment-groups', { token });
    const assignments = await api<Array<{ id: string }>>('/assignments', { token });

    assert.ok(projects.some((item) => item.id === project.id));
    assert.ok(persons.some((item) => item.id === person.id));
    assert.ok(groups.some((item) => item.id === group.id));
    assert.ok(assignments.some((item) => item.id === assignment.id));
  });

  it('actualiza proyecto y persona sin alterar su identidad', async () => {
    const session = await login(GENERADOR);
    const token = session.accessToken;

    const project = await api<{ id: string }>('/projects', {
      method: 'POST',
      token,
      body: {
        code: uniqueCode('Q'),
        name: `Proyecto Editable ${uniqueCode('E')}`,
        area: 'QUIMICA',
        scope: 'EXTERNO',
        startDate: '2026-02-01',
      },
      expected: 201,
    });
    const updatedProject = await api<{ name: string; status: string }>(`/projects/${project.id}`, {
      method: 'PATCH',
      token,
      body: { name: 'Proyecto Actualizado Integración', status: 'INACTIVO' },
    });
    assert.equal(updatedProject.name, 'Proyecto Actualizado Integración');
    assert.equal(updatedProject.status, 'INACTIVO');

    const person = await api<{ id: string }>('/persons', {
      method: 'POST',
      token,
      body: {
        documentType: 'V',
        documentNumber: uniqueDocument('ED'),
        firstName: 'Katherine',
        lastName: 'Johnson',
      },
      expected: 201,
    });
    const updatedPerson = await api<{ firstName: string; status: string }>(
      `/persons/${person.id}`,
      {
        method: 'PATCH',
        token,
        body: { firstName: 'Katherine Actualizada', status: 'INACTIVO' },
      },
    );
    assert.equal(updatedPerson.firstName, 'Katherine Actualizada');
    assert.equal(updatedPerson.status, 'INACTIVO');
  });
});
