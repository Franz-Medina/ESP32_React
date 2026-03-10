export async function loginToThingsBoard(username, password) {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({
      username,
      password
    })
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data.message || `Login failed. Status: ${response.status}`)
  }

  return data
}

export async function getCurrentThingsBoardUser(token) {
  const response = await fetch('/api/auth/user', {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'X-Authorization': `Bearer ${token}`
    }
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data.message || `Unable to get user information. Status: ${response.status}`)
  }

  return data
}