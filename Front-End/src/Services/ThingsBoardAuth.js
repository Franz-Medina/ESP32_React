const parseJsonSafely = async (response) => response.json().catch(() => ({}))

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

  const data = await parseJsonSafely(response)

  if (!response.ok) {
    throw new Error(data.message || `Login failed. Status: ${response.status}`)
  }

  if (!data.token || !data.refreshToken) {
    throw new Error('Login response did not include authentication tokens.')
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

  const data = await parseJsonSafely(response)

  if (!response.ok) {
    throw new Error(data.message || `Unable to get user information. Status: ${response.status}`)
  }

  return data
}