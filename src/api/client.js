const API_BASE = '/api';

export async function login(email, password) {
  const res = await fetch(`${API_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim(), password: password.trim() }),
  });
  return res.json();
}

export async function getCases(email) {
  const res = await fetch(`${API_BASE}/cases`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim() }),
  });
  return res.json();
}

export async function updateCase(caseId, updateFields = {}) {
  const res = await fetch(`${API_BASE}/cases/update`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      caseId,
      ...updateFields,
    }),
  });
  return res.json();
}

export async function getPicklistValues(object, field) {
  const res = await fetch(`${API_BASE}/picklist/${object}/${field}`);
  return res.json();
}

export async function getUniqueValues(object, field) {
  const res = await fetch(`${API_BASE}/unique-values/${object}/${field}`);
  return res.json();
}
